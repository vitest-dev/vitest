import type { Awaitable } from '@vitest/utils'
import type { Suite, SuiteHooks, Test } from './types'
import type { FixtureItem } from './fixture'

// use WeakMap here to make the Test and Suite object serializable
const fnMap = new WeakMap()
const fixtureMap = new WeakMap()
const hooksMap = new WeakMap()

export function setFn(key: Test, fn: (() => Awaitable<void>)) {
  fnMap.set(key, fn)
}

export function getFn<Task = Test>(key: Task): (() => Awaitable<void>) {
  return fnMap.get(key as any)
}

export function setFixture(key: Test, fixture: FixtureItem[] | undefined) {
  fixtureMap.set(key, fixture)
}

export function getFixture<Task = Test>(key: Task): FixtureItem[] {
  return fixtureMap.get(key as any)
}

export function setHooks(key: Suite, hooks: SuiteHooks) {
  hooksMap.set(key, hooks)
}

export function getHooks(key: Suite): SuiteHooks {
  return hooksMap.get(key)
}
