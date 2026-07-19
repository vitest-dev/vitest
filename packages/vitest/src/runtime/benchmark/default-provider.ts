import type { Task as TinybenchTask } from 'tinybench'
import type { BenchmarkGroup, BenchmarkProvider, BenchResult } from '../benchmark'
import type { SerializedConfig } from '../config'
import { Bench as Tinybench } from 'tinybench'
import { TestRunner } from '../runners/test'

const now = globalThis.performance
  ? globalThis.performance.now.bind(globalThis.performance)
  : Date.now

/**
 * The built-in benchmark provider, backed by tinybench. Selected when
 * `benchmark.provider` is `'default'` (the default).
 */
export function createDefaultBenchmarkProvider(config: SerializedConfig): BenchmarkProvider {
  let benchIdx = 0
  return {
    async run({ test, options, registrations }: BenchmarkGroup): Promise<BenchResult[]> {
      const currentIndex = ++benchIdx
      const tinybench = new Tinybench({
        signal: test.context.signal,
        name: `${test.fullTestName} ${currentIndex}`,
        retainSamples: config.benchmark.retainSamples,
        ...options,
        now,
      })
      for (const { name, fn, fnOpts } of registrations) {
        tinybench.add(name, fn, fnOpts)
      }
      await TestRunner.runBenchmarks(tinybench)

      const errors = tinybench.tasks
        .filter(task => task.result.state === 'errored')
        .map(task => (task.result as { error: unknown }).error)
      if (errors.length === 1) {
        throw errors[0]
      }
      if (errors.length > 1) {
        throw new AggregateError(errors, 'Some benchmarks failed')
      }

      return tinybench.tasks.map(toBenchResult)
    },
  }
}

function toBenchResult(task: TinybenchTask): BenchResult {
  const result = task.result
  if (result.state !== 'completed') {
    throw new Error(`task "${task.name}" did not complete: received "${result.state}"`)
  }
  return {
    ...result,
    name: task.name,
  }
}
