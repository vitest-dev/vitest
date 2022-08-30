import type { Bench as BenchFactory, Options as BenchOptions, Task as BenchTask, TaskResult as BenchTaskResult } from 'tinybench'
import type { BenchmarkBuiltinReporters } from '../node/reporters'
import type { ChainableFunction } from '../runtime/chain'
import type { Arrayable, Reporter, Suite, TaskBase, TaskResult } from '.'

export interface BenchmarkUserOptions {
  /**
   * Include globs for benchmark test files
   *
   * @default ['**\/*.{bench,benchmark}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}']
   */
  include?: string[]

  /**
   * Exclude globs for benchmark test files
   * @default ['node_modules', 'dist', '.idea', '.git', '.cache']
   */
  exclude?: string[]

  /**
   * Include globs for in-source test files
   *
   * @default []
   */
  includeSource?: string[]

  /**
   * Custom reporter for output. Can contain one or more built-in report names, reporter instances,
   * and/or paths to custom reporters
   */
  reporters?: Arrayable<BenchmarkBuiltinReporters | Reporter>
}

export interface Benchmark extends TaskBase {
  type: 'benchmark'
  suite: Suite
  result?: TaskResult
  fails?: boolean
  options: BenchOptions
}

export interface BenchmarkResult extends Omit<TaskResult, 'state'> {
  name: string
  count: number
  hz: number
  rme: number
  sampleSize: number
  sort: number
  max: number
  min: number
  p75: number
  p99: number
  p995: number
  p999: number
}

export type BenchFunction = (this: BenchFactory) => Promise<void> | void
export type BenchmarkAPI = ChainableFunction<
'skip',
[name: string, fn: BenchFunction, options?: BenchOptions],
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
