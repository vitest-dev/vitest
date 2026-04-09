import type { BenchOptions, Task as BenchTask, Fn, FnOptions } from 'tinybench'
import type { Test, TestBenchmark, TestBenchmarkTask, VitestRunner } from './types'
import { Bench as Tinybench } from 'tinybench'

const now = globalThis.performance
  ? globalThis.performance.now.bind(globalThis.performance)
  : Date.now

const kRegistration: unique symbol = Symbol('registration')
const kBaseline: unique symbol = Symbol('baseline')

type ExtractBenchNames<T extends BenchRegistration<any>[]> = Exclude<{
  [K in keyof T]: T[K] extends BenchRegistration<infer N> ? N : never
}[number], never>

interface BenchmarkStorage<T extends string> {
  get: (name: T) => BenchTask
}

export interface BenchRegistration<Name extends string> {
  name: Name
  fn: Fn
  fnOpts?: FnOptions
  run: (options?: BenchOptions) => Promise<BenchTask>
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

interface BenchCompare {
  <Args extends BenchRegistration<any>[]>(...args: Args): Promise<BenchmarkStorage<ExtractBenchNames<Args>>>
  <Args extends BenchRegistration<any>[]>(...args: [...Args, BenchOptions]): Promise<BenchmarkStorage<ExtractBenchNames<Args>>>
}

export interface Bench {
  <Name extends string>(name: Name, fn: Fn, fnOpts?: FnOptions): BenchRegistration<Name>
  withBaseline: <Name extends string>(name: Name, fn: Fn, fnOpts?: FnOptions) => BaselineRegistration<Name>
  run: BenchCompare
}

export function createBench(test: Test, runner: VitestRunner): Bench {
  let benchIdx = 0
  const createTinybench = (options?: BenchOptions) => {
    const currentIndex = ++benchIdx
    return new Tinybench({
      signal: test.context.signal,
      name: `${test.fullTestName} ${currentIndex}`,
      ...options,
      now,
    })
  }

  const createRegisteredTinybench = <Args extends BenchRegistration<any>[]>(name: 'compare' | 'compareSync', registrations: (BenchOptions | Args[0] | Args[number])[]) => {
    if (registrations.length === 0) {
      // TODO: links
      throw new SyntaxError(`\`bench.${name}\` requires at least 2 benchmarks, received 0 instead. Define benchmarks by calling \`bench()\`.`)
    }
    if (registrations.length < 2) {
      throw new SyntaxError(`\`bench.${name}\` requires at least 2 benchmarks, received 1 instead. Consider calling \`bench().${name === 'compare' ? 'run' : 'runSync'}()\`.`)
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

  const createCompareStorage = <T extends string>(bench: Tinybench): BenchmarkStorage<T> => {
    return {
      get(name: T) {
        const task = bench.getTask(name)
        if (!task) {
          throw new Error(`task "${name}" was not defined`)
        }
        return task
      },
    }
  }

  const serializeBenchmark = (bench: Tinybench): TestBenchmark => {
    const tasks = bench.tasks.map<TestBenchmarkTask>((t) => {
      const result = t.result
      if (result.state === 'errored') {
        throw result.error
      }
      if (result.state !== 'completed') {
        // TODO: different handling for different results
        // TODO: have a test for each state
        throw new Error(`task did not complete: received ${result.state}`)
      }
      return {
        name: t.name,
        latency: {
          ...result.latency,
          samples: undefined,
        },
        throughput: {
          ...result.throughput,
          samples: undefined,
        },
        period: result.period,
        totalTime: result.totalTime,
        rank: 0,
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

  const recordBenchmark = async (bench: Tinybench) => {
    const serializedBenchmark = serializeBenchmark(bench)
    test.benchmarks.push(serializedBenchmark)
    await runner.onTestBenchmark?.(test, serializedBenchmark)
  }

  const bench: Bench = function bench(
    name,
    fn,
    fnOpts,
  ) {
    return {
      [kRegistration]: true,
      name,
      fn,
      fnOpts,
      async run(options) {
        const bench = createTinybench(options).add(name, fn, fnOpts)
        await bench.run()
        await recordBenchmark(bench)
        return bench.getTask(name)!
      },
    }
  }

  bench.withBaseline = function withBaseline(
    name,
    fn,
    fnOpts,
  ) {
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
        return bench.getTask(name)!
      },
    }
  }

  bench.run = async (...registrations) => {
    const bench = createRegisteredTinybench('compare', registrations)
    await bench.run()
    await recordBenchmark(bench)
    return createCompareStorage(bench)
  }

  return bench
}
