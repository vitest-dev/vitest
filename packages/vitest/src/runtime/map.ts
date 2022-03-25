import type BenchmarkLib from 'benchmark'
import type { Awaitable, Benchmark, Suite, SuiteHooks, Test } from '../types'

// use WeakMap here to make the Test and Suite object serializable
const fnMap = new WeakMap()
const hooksMap = new WeakMap()
const benchmarkMap = new WeakMap()

export function setFn(key: Test, fn: () => Awaitable<void>) {
  fnMap.set(key, fn)
}

export function getFn(key: Test): () => Awaitable<void> {
  return fnMap.get(key)
}

export function setHooks(key: Suite, hooks: SuiteHooks) {
  hooksMap.set(key, hooks)
}

export function getHooks(key: Suite): SuiteHooks {
  return hooksMap.get(key)
}

export function setBenchmark(key: Benchmark, fn: BenchmarkLib.Suite) {
  benchmarkMap.set(key, fn)
}

export function getBenchmark(key: Benchmark): BenchmarkLib.Suite {
  return benchmarkMap.get(key)
}
