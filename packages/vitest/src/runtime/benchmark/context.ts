import type BenchmarkLib from 'tinybench'
import type { Awaitable, Benchmark, BenchmarkCollector, BenchmarkContext } from '../../types'

const benchmarkMap = new WeakMap()

export function setBenchmark(key: Benchmark, fn: BenchmarkLib.Suite) {
  benchmarkMap.set(key, fn)
}

export function getBenchmark(key: Benchmark): BenchmarkLib.Suite {
  return benchmarkMap.get(key)
}

export const benchmarkContext: BenchmarkContext = {
  currentBenchmark: null,
}

export async function runWithBenchmark(benchmark: BenchmarkCollector, fn: (() => Awaitable<void>)) {
  const prev = benchmarkContext.currentBenchmark
  benchmarkContext.currentBenchmark = benchmark
  await fn()
  benchmarkContext.currentBenchmark = prev
}

export function collectBenchmark(benchmark: BenchmarkCollector) {
  benchmarkContext.currentBenchmark?.tasks.push(benchmark)
}
