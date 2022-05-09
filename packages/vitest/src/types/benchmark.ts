import type { BenchmarkBuiltinReporters } from '../node/reporters'
import type { Arrayable, Awaitable, File, Reporter, RunMode, Task, TaskBase, TaskResult } from '.'

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
  benchmark?: Benchmark
  tasks: Task[]
  result?: BenchmarkResult
}

export interface BenchmarkResult extends TaskResult {
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

export interface BenchmarkOptions {
  delay?: number | undefined
  initCount?: number | undefined
  maxTime?: number | undefined
  minSamples?: number | undefined
  minTime?: number | undefined
  async?: boolean | undefined
  defer?: boolean | undefined
  queued?: boolean | undefined
}

export type BenchFunction = () => Awaitable<void>

export type BenchmarkFactory = (test: (name: string, fn: BenchFunction, options?: BenchmarkOptions) => void) => Awaitable<void>

export interface BenchmarkCollector {
  readonly name: string
  readonly mode: RunMode
  tasks: (Benchmark | BenchmarkCollector)[]
  type: 'benchmark-collector'
  bench: (name: string, fn: BenchFunction, options?: BenchmarkOptions) => void
  collect: (file?: File) => Promise<Benchmark>
  clear: () => void
}

export interface BenchmarkContext {
  currentBenchmark: BenchmarkCollector | null
}
