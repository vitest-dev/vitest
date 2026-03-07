import type { Test } from '@vitest/runner'
import type { ChainableFunction } from '@vitest/runner/utils'
import type {
  Bench,
  Fn as BenchFunction,
  BenchOptions,
  Statistics as TinybenchStatistics,
  Task as TinybenchTask,
  TaskResult as TinybenchTaskResult,
} from 'tinybench'

export type BenchmarkStatistics = Omit<TinybenchStatistics, 'samples'> & {
  samples: number[] | undefined
}

export interface Benchmark extends Test {
  meta: {
    benchmark: true
    result?: TinybenchTaskResult
  }
}

export interface BenchmarkResult {
  name: string
  rank: number
  samplesCount: number
  latency: BenchmarkStatistics
  throughput: BenchmarkStatistics
  period: number
  totalTime: number
}

type ChainableBenchmarkAPI = ChainableFunction<
  'skip' | 'only' | 'todo',
  (name: string | Function, fn?: BenchFunction, options?: BenchOptions) => void
>
export type BenchmarkAPI = ChainableBenchmarkAPI & {
  skipIf: (condition: any) => ChainableBenchmarkAPI
  runIf: (condition: any) => ChainableBenchmarkAPI
}

export { Bench, BenchFunction, BenchOptions, TinybenchTask, TinybenchTaskResult }
