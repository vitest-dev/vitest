import type { Test } from '@vitest/runner'
import type { ChainableFunction } from '@vitest/runner/utils'
import type {
  Bench as BenchFactory,
  Options as BenchOptions,
  Task as BenchTask,
  TaskResult as BenchTaskResult,
  TaskResult as TinybenchResult,
} from 'tinybench'

export interface Benchmark extends Test {
  meta: {
    benchmark: true
    result?: BenchTaskResult
  }
}

export interface BenchmarkResult extends TinybenchResult {
  name: string
  rank: number
  sampleCount: number
  median: number
}

export type BenchFunction = (this: BenchFactory) => Promise<void> | void
type ChainableBenchmarkAPI = ChainableFunction<
  'skip' | 'only' | 'todo',
  (name: string | Function, fn?: BenchFunction, options?: BenchOptions) => void
>
export type BenchmarkAPI = ChainableBenchmarkAPI & {
  skipIf: (condition: any) => ChainableBenchmarkAPI
  runIf: (condition: any) => ChainableBenchmarkAPI
}

export { BenchFactory, BenchOptions, BenchTask, BenchTaskResult }
