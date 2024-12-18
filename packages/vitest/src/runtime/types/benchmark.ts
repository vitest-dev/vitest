import type { Test } from '@vitest/runner'
import type { ChainableFunction } from '@vitest/runner/utils'
import type {
  Bench,
  Fn as BenchFunction,
  FnOptions as BenchOptions,
  Task as TinybenchTask,
  TaskResult as TinybenchTaskResult,
} from 'tinybench'

export interface Benchmark extends Test {
  meta: {
    benchmark: true
    result?: TinybenchTaskResult
  }
}

export interface BenchmarkResult extends TinybenchTaskResult {
  name: string
  rank: number
  numberOfSamples: number
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
