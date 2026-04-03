import type { Test } from '@vitest/runner'
import type { BenchFunction, BenchmarkAPI, BenchOptions } from './types/benchmark'
import { createChainable } from '@vitest/runner/utils'

const benchFns = new WeakMap<Test, BenchFunction>()
const benchOptsMap = new WeakMap()

export function getBenchOptions(key: Test): BenchOptions {
  return benchOptsMap.get(key)
}

export function getBenchFn(key: Test): BenchFunction {
  return benchFns.get(key)!
}

export const bench: BenchmarkAPI = createBenchmark(() => {
  throw new Error(`use 'bench' from test's context`)
})

function createBenchmark(
  fn: (
    this: Record<'skip' | 'only' | 'todo', boolean | undefined>,
    name: string | Function,
    fn?: BenchFunction,
    options?: BenchOptions,
  ) => void,
) {
  const benchmark = createChainable(
    ['skip', 'only', 'todo'],
    fn,
  ) as BenchmarkAPI

  benchmark.skipIf = (condition: any) =>
    (condition ? benchmark.skip : benchmark) as BenchmarkAPI
  benchmark.runIf = (condition: any) =>
    (condition ? benchmark : benchmark.skip) as BenchmarkAPI

  return benchmark as BenchmarkAPI
}
