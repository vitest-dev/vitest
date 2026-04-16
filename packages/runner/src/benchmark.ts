import type { BenchOptions, Fn, FnOptions, TaskResultCompleted, TaskResultRuntimeInfo, TaskResultTimestampProviderInfo } from 'tinybench'
import type { Test, TestBenchmark, TestBenchmarkTask, VitestRunner } from './types'
import { Bench as Tinybench } from 'tinybench'

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

export interface BenchRegistration<Name extends string> {
  name: Name
  fn: Fn
  fnOpts?: FnOptions
  run: (options?: BenchOptions) => Promise<BenchResult>
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
  <Args extends BenchRegistration<any>[]>(...args: [...Args, BenchOptions]): Promise<BenchStorage<ExtractBenchNames<Args>>>
}

export interface Bench {
  <Name extends string>(name: Name, fn: Fn, fnOpts?: FnOptions): BenchRegistration<Name>
  withBaseline: <Name extends string>(name: Name, fn: Fn, fnOpts?: FnOptions) => BaselineRegistration<Name>
  compare: BenchCompare
  perProject: <Name extends string>(name: Name, fn: Fn, fnOpts?: FnOptions) => PerProjectRegistration<Name>
}

export function createBench(test: Test, runner: VitestRunner): Bench {
  let benchIdx = 0
  const createTinybench = (options?: BenchOptions) => {
    const currentIndex = ++benchIdx
    return new Tinybench({
      signal: test.context.signal,
      name: `${test.fullTestName} ${currentIndex}`,
      retainSamples: runner.config.benchmark.retainSamples,
      ...options,
      now,
    })
  }

  const createRegisteredTinybench = <Args extends BenchRegistration<any>[]>(name: 'compare' | 'compareSync', registrations: (BenchOptions | Args[0] | Args[number])[]) => {
    if (registrations.length === 0) {
      throw new SyntaxError(`\`bench.${name}\` requires at least 2 benchmarks, received 0 instead. Define benchmarks by calling \`bench()\`. See https://vitest.dev/guide/benchmarking#comparing-benchmarks`)
    }
    if (registrations.length < 2) {
      throw new SyntaxError(`\`bench.${name}\` requires at least 2 benchmarks, received 1 instead. Consider calling \`bench().${name === 'compare' ? 'run' : 'runSync'}()\`. See https://vitest.dev/guide/benchmarking#comparing-benchmarks`)
    }
    const lastArg = registrations.splice(registrations.length - 1, 1)[0]
    const benchOptions = typeof lastArg === 'object' && kRegistration in lastArg ? undefined : lastArg
    const bench = createTinybench(benchOptions)
    registrations.forEach((registration) => {
      if (!(kRegistration in registration)) {
        throw new SyntaxError('`bench.compare` expects every argument to be the return value of `bench`')
      }
      bench.add(registration.name, registration.fn, registration.fnOpts)
    })
    return bench
  }

  const createCompareStorage = <T extends string>(bench: Tinybench): BenchStorage<T> => {
    return {
      get(name: T) {
        const task = bench.getTask(name)
        if (!task) {
          throw new Error(`task "${name}" was not defined`)
        }
        return task.result as BenchResult
      },
    }
  }

  const serializeBenchmark = (bench: Tinybench, perProjectNames?: Set<string>): TestBenchmark => {
    const tasks = bench.tasks.map<TestBenchmarkTask>((t) => {
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
    }).sort((a, b) => a.latency.mean - b.latency.mean)
    tasks.forEach((task, idx) => {
      task.rank = idx + 1
    })
    return {
      name: bench.name || test.fullTestName,
      tasks,
    }
  }

  const recordBenchmark = async (bench: Tinybench, perProjectNames?: Set<string>) => {
    const serializedBenchmark = serializeBenchmark(bench, perProjectNames)
    test.benchmarks.push(serializedBenchmark)
    await runner.onTestBenchmark?.(test, serializedBenchmark)
  }

  const runSingle = async (name: string, fn: Fn, fnOpts: FnOptions | undefined, options: BenchOptions | undefined, perProjectNames?: Set<string>): Promise<BenchResult> => {
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
    validateBenchmarkProject(runner)
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
    validateBenchmarkProject(runner)
    return {
      [kRegistration]: true,
      [kBaseline]: true,
      name,
      fn,
      fnOpts,
      async run(options) {
        const bench = createTinybench(options).add(name, fn, fnOpts)
        await bench.run()
        // TODO: store result to baseline file
        return bench.getTask(name)!.result as BenchResult
      },
    }
  }

  bench.perProject = function perProject(name, fn, fnOpts) {
    validateBenchmarkProject(runner)
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
    validateBenchmarkProject(runner)
    const perProjectNames = new Set<string>()
    for (const reg of registrations) {
      if (typeof reg === 'object' && kPerProject in reg) {
        perProjectNames.add(reg.name)
      }
    }
    const tinybench = createRegisteredTinybench('compare', registrations)
    await tinybench.run()
    const errors = tinybench.tasks
      .filter(task => task.result.state === 'errored')
      .map(task => (task.result as any).error)
    if (errors.length > 0) {
      throw new AggregateError(errors, 'Some benchmarks failed')
    }
    await recordBenchmark(tinybench, perProjectNames.size > 0 ? perProjectNames : undefined)
    return createCompareStorage(tinybench)
  }

  return bench
}

function validateBenchmarkProject(runner: VitestRunner) {
  if (!runner.config.benchmark.enabled) {
    throw new Error(
      `Cannot run a benchmark within a regular test run. `
      + `Benchmarks are inherently flaky, so Vitest groups them into its own project based on \`benchmark.include\` pattern. `
      + `Are you using the \`bench\` function within a regular test? `
      + `See more at https://vitest.dev/guide/benchmarking#stability`,
    )
  }
}
