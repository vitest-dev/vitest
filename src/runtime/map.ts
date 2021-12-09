import { Awaitable } from '@antfu/utils'
import { SuiteHooks } from 'vitest'
import { Suite, Task } from '../types'

const fnMap = new WeakMap()
const hooksMap = new WeakMap()

export function setFn(key: Task, fn: () => Awaitable<void>) {
  fnMap.set(key, fn)
}

export function getFn(key: Task): () => Awaitable<void> {
  return fnMap.get(key)
}

export function setHooks(key: Suite, hooks: SuiteHooks) {
  hooksMap.set(key, hooks)
}

export function getHooks(key: Suite): SuiteHooks {
  return hooksMap.get(key)
}
