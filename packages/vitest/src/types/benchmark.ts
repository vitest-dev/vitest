import type { TaskCustom } from '@vitest/runner'
import type { ChainableFunction } from '@vitest/runner/utils'
import type { Arrayable } from '@vitest/utils'
import type { Bench as BenchFactory, Options as BenchOptions, Task as BenchTask, TaskResult as BenchTaskResult, TaskResult as TinybenchResult } from 'tinybench'
import type { BenchmarkBuiltinReporters } from '../node/reporters'
import type { Reporter } from './reporter'

export interface BenchmarkUserOptions {
  /**
   * Include globs for benchmark test files
   *
   * @default ['**\/*.{bench,benchmark}.?(c|m)[jt]s?(x)']
   */
  include?: string[]

  /**
   * Exclude globs for benchmark test files
   * @default ['node_modules', 'dist', '.idea', '.git', '.cache']
   */
  exclude?: string[]

  /**
   * Include globs for in-source benchmark test files
   *
   * @default []
   */
  includeSource?: string[]

  /**
   * Custom reporter for output. Can contain one or more built-in report names, reporter instances,
   * and/or paths to custom reporters
   */
  reporters?: Arrayable<BenchmarkBuiltinReporters | Reporter>

  /**
   * Write test results to a file when the `--reporter=json` option is also specified.
   * Also definable individually per reporter by using an object instead.
   */
  outputFile?: string | (Partial<Record<BenchmarkBuiltinReporters, string>> & Record<string, string>)
}

export interface Benchmark extends TaskCustom {
  meta: {
    benchmark: true
    result?: BenchTaskResult
  }
}

export interface BenchmarkResult extends TinybenchResult {
  name: string
  rank: number
}

export type BenchFunction = (this: BenchFactory) => Promise<void> | void
export type BenchmarkAPI = ChainableFunction<
'skip' | 'only' | 'todo',
[name: string, fn?: BenchFunction, options?: BenchOptions],
void
> & {
  skipIf(condition: any): BenchmarkAPI
  runIf(condition: any): BenchmarkAPI
}

export {
  BenchTaskResult,
  BenchOptions,
  BenchFactory,
  BenchTask,
}
