import type TinyBench from 'tinybench'
import type { BenchmarkBuiltinReporters } from '../node/reporters'
import type { ChainableFunction } from '../runtime/chain'
import type { Arrayable, Reporter, Suite, TaskBase, TaskResult } from '.'

export interface BenchmarkUserOptions {
  /**
   * Include globs for benchmark test files
   *
   * @default ['**\/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}']
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
  reporters?: Arrayable<BenchmarkBuiltinReporters | Reporter | Omit<string, BenchmarkBuiltinReporters>>
}

export interface Benchmark extends TaskBase {
  type: 'benchmark'
  suite: Suite
  result?: TaskResult
  fails?: boolean
  options: BenchmarkOptions
}

export interface BenchmarkResult {
  cycle: Array<{
    name: string
    count: number
    cycles: number
    hz: number
    rme: number
    sampleSize: number
  }>
  complete: {
    fastest: string
  }
}

export type BenchmarkOptions = TinyBench.Options
export type BenchFunction = (this: TinyBench.Suite, deferred: TinyBench.Deferred) => void
export type BenchmarkAPI = ChainableFunction<
'skip',
[name: string, fn?: BenchFunction, options?: BenchmarkOptions],
void
> & {
  skipIf(condition: any): BenchmarkAPI
  runIf(condition: any): BenchmarkAPI
}
