import type { SuiteHooks } from 'vitest'
import type { Awaitable, Suite, Test } from '../types'

// use WeakMap here to make the Test and Suite object serializable
const fnMap = new WeakMap()
const hooksMap = new WeakMap()

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
