import type { Awaitable, Benchmark, Suite, SuiteHooks, Test } from '../types'

// use WeakMap here to make the Test and Suite object serializable
const fnMap = new WeakMap()
const hooksMap = new WeakMap()

export function setFn(key: Test | Benchmark, fn: () => Awaitable<void>) {
  fnMap.set(key, fn)
}

export function getFn(key: Test | Benchmark): () => Awaitable<void> {
  return fnMap.get(key)
}

export function setHooks(key: Suite, hooks: SuiteHooks) {
  hooksMap.set(key, hooks)
}

export function getHooks(key: Suite): SuiteHooks {
  return hooksMap.get(key)
}
