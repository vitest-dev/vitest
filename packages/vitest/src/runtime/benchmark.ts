import type { BaselineData, Test, TestBenchmark, TestBenchmarkTask } from '@vitest/runner'
import type {
  BenchOptions as BenchCompareOptions,
  Fn,
  FnOptions,
  TaskResultCompleted,
  TaskResultRuntimeInfo,
  TaskResultTimestampProviderInfo,
} from 'tinybench'
import type { SerializedConfig } from './config'
import { Bench as Tinybench } from 'tinybench'
import { rpc } from './rpc'

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

  const createRegisteredTinybench = <Args extends BenchRegistration<any>[]>(name: 'compare' | 'compareSync', registrations: (BenchCompareOptions | Args[0] | Args[number])[]) => {
    if (registrations.length === 0) {
      throw new SyntaxError(`\`bench.${name}\` requires at least 2 benchmarks, received 0 instead. Define benchmarks by calling \`bench()\`. See https://vitest.dev/guide/benchmarking#comparing-benchmarks`)
    }
    // TODO: validate after removing options
    if (registrations.length < 2) {
      throw new SyntaxError(`\`bench.${name}\` requires at least 2 benchmarks, received 1 instead. Consider calling \`bench().${name === 'compare' ? 'run' : 'runSync'}()\`. See https://vitest.dev/guide/benchmarking#comparing-benchmarks`)
    }
    // TOOD: does this _always_ remove the last element?
    const lastArg = registrations.splice(registrations.length - 1, 1)[0]
    const benchOptions = typeof lastArg === 'object' && kRegistration in lastArg ? undefined : lastArg
    const bench = createTinybench(benchOptions)
    registrations.forEach((registration) => {
      if (!(kRegistration in registration)) {
        throw new SyntaxError('`bench.compare` expects every argument to be the return value of `bench`, `bench.perProject` or `bench.withBaseline`.')
      }
      bench.add(registration.name, registration.fn, registration.fnOpts)
    })
    return bench
  }

  const createCompareStorage = <T extends string>(bench: Tinybench, storedBaselines?: Map<string, BaselineData>): BenchStorage<T> => {
    return {
      get(name: T) {
        const stored = storedBaselines?.get(name)
        if (stored) {
          return stored as unknown as BenchResult
        }
        const task = bench.getTask(name)
        if (!task) {
          throw new Error(`task "${name}" was not defined`)
        }
        return task.result as BenchResult
      },
    }
  }

  const extractBaselineData = (result: BenchResult): BaselineData => ({
    latency: result.latency,
    throughput: result.throughput,
    period: result.period,
    totalTime: result.totalTime,
  })

  const serializeBenchmark = (
    bench: Tinybench,
    perProjectNames?: Set<string>,
    storedBaselines?: Map<string, BaselineData>,
  ): TestBenchmark => {
    const tasks: TestBenchmarkTask[] = bench.tasks.map((t) => {
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
        ...(perProjectNames?.has(t.name) ? { perProject: true } : {}),
      }
    })
    // inject stored baselines that were not run
    if (storedBaselines) {
      for (const [name, data] of storedBaselines) {
        tasks.push({
          name,
          latency: data.latency,
          throughput: data.throughput,
          period: data.period,
          totalTime: data.totalTime,
          rank: 0,
          baseline: true,
        })
      }
    }
    tasks.sort((a, b) => a.latency.mean - b.latency.mean)
    tasks.forEach((task, idx) => {
      task.rank = idx + 1
    })
    return {
      name: bench.name || test.fullTestName,
      tasks,
    }
  }

  const recordBenchmark = async (
    bench: Tinybench,
    perProjectNames?: Set<string>,
    storedBaselines?: Map<string, BaselineData>,
  ) => {
    const serializedBenchmark = serializeBenchmark(bench, perProjectNames, storedBaselines)
    test.benchmarks.push(serializedBenchmark)
    await rpc().onTestBenchmark(test.id, serializedBenchmark)
  }

  const runSingle = async (name: string, fn: Fn, fnOpts: FnOptions | undefined, options: BenchCompareOptions | undefined, perProjectNames?: Set<string>): Promise<BenchResult> => {
    const tinybench = createTinybench(options).add(name, fn, fnOpts)
    await tinybench.run()
    const task = tinybench.getTask(name)!
    if (task.result.state === 'errored') {
      throw task.result.error
    }
    await recordBenchmark(tinybench, perProjectNames)
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
        const key = `${test.fullTestName}/${name}`
        const existing = await rpc().readBenchmarkBaseline(test.file.filepath, key)
        // if a stored baseline exists and we're not updating, use it
        if (existing && !config.benchmark.updateBaselines) {
          return existing as unknown as BenchResult
        }
        // no stored baseline or updating — run the benchmark and save
        const tinybench = createTinybench(options).add(name, fn, fnOpts)
        await tinybench.run()
        const task = tinybench.getTask(name)!
        if (task.result.state === 'errored') {
          throw task.result.error
        }
        const result = task.result as BenchResult
        await rpc().saveBenchmarkBaseline(test.file.filepath, key, extractBaselineData(result))
        await recordBenchmark(tinybench)
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
      run: options => runSingle(name, fn, fnOpts, options, new Set([name])),
    }
  }

  bench.compare = async (...registrations) => {
    validateBenchmarkProject(config)
    const perProjectNames = new Set<string>()
    const baselineNames = new Set<string>()
    for (const reg of registrations) {
      if (typeof reg === 'object' && kPerProject in reg) {
        perProjectNames.add(reg.name)
      }
      if (typeof reg === 'object' && kBaseline in reg) {
        baselineNames.add(reg.name)
      }
    }

    // read stored baselines before creating tinybench
    const storedBaselines = new Map<string, BaselineData>()
    if (!config.benchmark.updateBaselines && baselineNames.size > 0) {
      await Promise.all(
        [...baselineNames].map(async (name) => {
          const key = `${test.fullTestName}/${name}`
          const existing = await rpc().readBenchmarkBaseline(test.file.filepath, key)
          if (existing) {
            storedBaselines.set(name, existing)
          }
        }),
      )
    }

    // filter out baseline registrations that have stored data — don't run them
    const filteredRegistrations = registrations.filter((reg) => {
      return !(typeof reg === 'object' && kBaseline in reg && storedBaselines.has(reg.name))
    })
    const tinybench = createRegisteredTinybench('compare', filteredRegistrations)
    await tinybench.run()
    const errors = tinybench.tasks
      .filter(task => task.result.state === 'errored')
      .map(task => (task.result as any).error)
    if (errors.length > 0) {
      throw new AggregateError(errors, 'Some benchmarks failed')
    }

    // save baselines for tasks that were actually run
    await Promise.all(
      [...baselineNames]
        .filter(name => !storedBaselines.has(name))
        .map((name) => {
          const key = `${test.fullTestName}/${name}`
          const task = tinybench.getTask(name)!
          return rpc().saveBenchmarkBaseline(test.file.filepath, key, extractBaselineData(task.result as BenchResult))
        }),
    )

    await recordBenchmark(
      tinybench,
      perProjectNames.size > 0 ? perProjectNames : undefined,
      storedBaselines.size > 0 ? storedBaselines : undefined,
    )
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
