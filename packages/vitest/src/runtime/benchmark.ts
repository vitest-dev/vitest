import type { BaselineData, Test, TestBenchmark, TestBenchmarkTask } from '@vitest/runner'
import type {
  BenchOptions as BenchCompareOptions,
  Fn,
  FnOptions,
  TaskResultCompleted,
  TaskResultRuntimeInfo,
  TaskResultTimestampProviderInfo,
  Task as TinybenchTask,
} from 'tinybench'
import type { SerializedConfig } from './config'
import { Bench as Tinybench } from 'tinybench'
import { rpc } from './rpc'
import { TestRunner } from './runners/test'

const now = globalThis.performance
  ? globalThis.performance.now.bind(globalThis.performance)
  : Date.now

const kRegistration: unique symbol = Symbol('registration')
const kBaseline: unique symbol = Symbol('baseline')
const kPerProject: unique symbol = Symbol('perProject')

type ExtractBenchNames<T extends BenchRegistration<any>[]> = Exclude<{
  [K in keyof T]: T[K] extends BenchRegistration<infer N> ? N : never
}[number], never>

// We throw an error if benchmark did not complete, so it will always be TaskResultCompleted
export type BenchResult = TaskResultCompleted & TaskResultRuntimeInfo & TaskResultTimestampProviderInfo

export interface BenchStorage<T extends string> {
  get: (name: T) => BenchResult
}

export type { BenchOptions as BenchCompareOptions, FnOptions as BenchFnOptions } from 'tinybench'

export interface BenchRegistration<Name extends string> {
  name: Name
  fn: Fn
  fnOpts?: FnOptions
  run: (options?: BenchCompareOptions) => Promise<BenchResult>
  /**
   * @internal
   */
  [kRegistration]: true
}

export interface BaselineRegistration<Name extends string> extends BenchRegistration<Name> {
  /**
   * @internal
   */
  [kBaseline]: true
}

export interface PerProjectRegistration<Name extends string> extends BenchRegistration<Name> {
  /**
   * @internal
   */
  [kPerProject]: true
}

interface BenchCompare {
  <Args extends BenchRegistration<any>[]>(...args: Args): Promise<BenchStorage<ExtractBenchNames<Args>>>
  <Args extends BenchRegistration<any>[]>(...args: [...Args, BenchCompareOptions]): Promise<BenchStorage<ExtractBenchNames<Args>>>
}

export interface Bench {
  <Name extends string>(name: Name, fn: Fn, fnOpts?: FnOptions): BenchRegistration<Name>
  // TODO: support having both withBaseline and perProject
  withBaseline: <Name extends string>(name: Name, fn: Fn, fnOpts?: FnOptions) => BaselineRegistration<Name>
  compare: BenchCompare
  perProject: <Name extends string>(name: Name, fn: Fn, fnOpts?: FnOptions) => PerProjectRegistration<Name>
}

export function createBench(test: Test, config: SerializedConfig): Bench {
  let benchIdx = 0
  const createTinybench = (options?: BenchCompareOptions) => {
    const currentIndex = ++benchIdx
    return new Tinybench({
      signal: test.context.signal,
      name: `${test.fullTestName} ${currentIndex}`,
      retainSamples: config.benchmark.retainSamples,
      ...options,
      now,
    })
  }

  const createCompareStorage = <T extends string>(bench: Tinybench, storedBaselines?: Map<string, BaselineData>): BenchStorage<T> => {
    return {
      get(name: T) {
        const stored = storedBaselines?.get(name)
        if (stored) {
          return stored as BenchResult
        }
        const task = bench.getTask(name)
        if (!task) {
          throw new Error(`task "${name}" was not defined`)
        }
        return task.result as BenchResult
      },
    }
  }

  const baselineKey = (name: string) => {
    const project = test.file.projectName
    return project ? `${project} > ${test.fullTestName} > ${name}` : `${test.fullTestName} > ${name}`
  }

  interface TaskMeta { perProject?: true; baseline?: true }

  const serializeBenchmark = (
    tinybenchTasks: TinybenchTask[],
    name: string | undefined,
    taskMeta?: Map<string, TaskMeta>,
    storedBaselines?: Map<string, BaselineData>,
  ): TestBenchmark => {
    const tasks: TestBenchmarkTask[] = tinybenchTasks.map((t) => {
      const result = t.result
      if (result.state === 'errored') {
        throw result.error
      }
      if (result.state !== 'completed') {
        throw new Error(`task "${t.name}" did not complete: received "${result.state}"`)
      }
      return {
        name: t.name,
        latency: result.latency,
        throughput: result.throughput,
        period: result.period,
        totalTime: result.totalTime,
        rank: 0,
        ...taskMeta?.get(t.name),
      }
    })
    // inject stored baselines that were not run (no `baseline` flag — already saved)
    if (storedBaselines) {
      for (const [name, data] of storedBaselines) {
        tasks.push({
          name,
          latency: data.latency,
          throughput: data.throughput,
          period: data.period,
          totalTime: data.totalTime,
          rank: 0,
        })
      }
    }
    tasks.sort((a, b) => a.latency.mean - b.latency.mean)
    tasks.forEach((task, idx) => {
      task.rank = idx + 1
    })
    return {
      name: name || test.fullTestName,
      tasks,
    }
  }

  const recordBenchmark = async (
    tinybenchTasks: TinybenchTask[],
    name: string | undefined,
    taskMeta?: Map<string, TaskMeta>,
    storedBaselines?: Map<string, BaselineData>,
  ) => {
    const serializedBenchmark = serializeBenchmark(tinybenchTasks, name, taskMeta, storedBaselines)
    test.benchmarks.push(serializedBenchmark)
    await rpc().onTestBenchmark(test.id, serializedBenchmark)
  }

  const runSingle = async (name: string, fn: Fn, fnOpts: FnOptions | undefined, options: BenchCompareOptions | undefined, meta?: TaskMeta): Promise<BenchResult> => {
    const tinybench = createTinybench(options).add(name, fn, fnOpts)
    const tasks = await TestRunner.runBenchmarks(tinybench)
    await recordBenchmark(tasks, tinybench.name, meta ? new Map([[name, meta]]) : undefined)
    const task = tinybench.getTask(name)!
    return task.result as BenchResult
  }

  const bench: Bench = function bench(
    name,
    fn,
    fnOpts,
  ) {
    validateBenchmarkProject(config)
    return {
      [kRegistration]: true,
      name,
      fn,
      fnOpts,
      run: options => runSingle(name, fn, fnOpts, options),
    }
  }

  bench.withBaseline = function withBaseline(
    name,
    fn,
    fnOpts,
  ) {
    validateBenchmarkProject(config)
    return {
      [kRegistration]: true,
      [kBaseline]: true,
      name,
      fn,
      fnOpts,
      async run(options) {
        const key = baselineKey(name)
        const existing = await rpc().readBenchmarkBaseline(test.file.filepath, key)
        // if a stored baseline exists and we're not updating, use it
        if (existing && !config.benchmark.updateBaselines) {
          const benchmark: TestBenchmark = {
            name: options?.name || test.fullTestName,
            tasks: [{
              name,
              latency: existing.latency,
              throughput: existing.throughput,
              period: existing.period,
              totalTime: existing.totalTime,
              rank: 1,
            }],
          }
          test.benchmarks.push(benchmark)
          await rpc().onTestBenchmark(test.id, benchmark)
          return existing as unknown as BenchResult
        }
        // no stored baseline or updating — run the benchmark and save
        const tinybench = createTinybench(options).add(name, fn, fnOpts)
        const tasks = await TestRunner.runBenchmarks(tinybench)
        const task = tinybench.getTask(name)!
        if (task.result.state === 'errored') {
          throw task.result.error
        }
        const result = task.result as BenchResult
        await recordBenchmark(tasks, tinybench.name, new Map([[name, { baseline: true }]]))
        return result
      },
    }
  }

  bench.perProject = function perProject(name, fn, fnOpts) {
    validateBenchmarkProject(config)
    return {
      [kRegistration]: true,
      [kPerProject]: true,
      name,
      fn,
      fnOpts,
      run: options => runSingle(name, fn, fnOpts, options, { perProject: true }),
    }
  }

  bench.compare = async (...args) => {
    validateBenchmarkProject(config)

    // extract optional trailing BenchCompareOptions argument
    const lastArg = args[args.length - 1]
    const isOptions = lastArg != null && typeof lastArg === 'object' && !(kRegistration in lastArg)
    const benchOptions = isOptions ? args.pop() as BenchCompareOptions : undefined
    const registrations = args as BenchRegistration<any>[]

    // validate against the ORIGINAL registrations — stored-baseline filtering
    // below may shrink the list, but a caller who passed enough benchmarks
    // shouldn't be told they passed too few
    if (registrations.length < 2) {
      throw new SyntaxError(`\`bench.compare()\` requires at least 2 benchmarks, received ${registrations.length} instead. ${registrations.length === 1 ? 'Consider calling `bench().run()`. ' : 'Define benchmarks by calling `bench()`. '}See https://vitest.dev/guide/benchmarking#comparing-benchmarks`)
    }
    for (const reg of registrations) {
      if (reg == null || typeof reg !== 'object' || !(kRegistration in reg)) {
        throw new SyntaxError('`bench.compare()` expects every argument to be the return value of `bench`, `bench.perProject` or `bench.withBaseline`.')
      }
    }

    const taskMeta = new Map<string, TaskMeta>()
    for (const reg of registrations) {
      const meta: TaskMeta = {}
      if (kPerProject in reg) {
        meta.perProject = true
      }
      if (kBaseline in reg) {
        meta.baseline = true
      }
      if (meta.perProject || meta.baseline) {
        taskMeta.set(reg.name, meta)
      }
    }

    // read stored baselines before creating tinybench
    const storedBaselines = new Map<string, BaselineData>()
    if (!config.benchmark.updateBaselines) {
      await Promise.all(
        [...taskMeta].filter(([, m]) => m.baseline).map(async ([name]) => {
          const key = baselineKey(name)
          const existing = await rpc().readBenchmarkBaseline(test.file.filepath, key)
          if (existing) {
            storedBaselines.set(name, existing)
          }
        }),
      )
    }

    // filter out baseline registrations that have stored data — don't run them
    const filteredRegistrations = registrations.filter(reg => !(kBaseline in reg && storedBaselines.has(reg.name)))

    const tinybench = createTinybench(benchOptions)
    filteredRegistrations.forEach((reg) => {
      tinybench.add(reg.name, reg.fn, reg.fnOpts)
    })

    let tasks: TinybenchTask[] = []

    // skip the tinybench run when every registration is already served from
    // a stored baseline — serializing + the storage fall back to baselines
    if (filteredRegistrations.length > 0) {
      tasks = await TestRunner.runBenchmarks(tinybench)
      const errors = tinybench.tasks
        .filter(task => task.result.state === 'errored')
        .map(task => (task.result as any).error)
      if (errors.length > 0) {
        throw new AggregateError(errors, 'Some benchmarks failed')
      }
    }

    await recordBenchmark(tasks, tinybench.name, taskMeta, storedBaselines)
    return createCompareStorage(tinybench, storedBaselines)
  }

  return bench
}

function validateBenchmarkProject(config: SerializedConfig) {
  if (!config.benchmark.enabled) {
    throw new Error(
      `Cannot run a benchmark within a regular test run. `
      + `Benchmarks are inherently flaky, so Vitest groups them into its own project based on \`benchmark.include\` pattern. `
      + `Are you using the \`bench\` function within a regular test? `
      + `See more at https://vitest.dev/guide/benchmarking#stability`,
    )
  }
}
