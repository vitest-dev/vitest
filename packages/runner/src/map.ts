import type { Awaitable } from '@vitest/utils'
import type { Custom, Suite, SuiteHooks, Test, TestContext } from './types'
import type { FixtureItem } from './fixture'

// use WeakMap here to make the Test and Suite object serializable
const fnMap = new WeakMap()
const fixtureMap = new WeakMap()
const hooksMap = new WeakMap()

export function setFn(key: Test | Custom, fn: (() => Awaitable<void>)) {
  fnMap.set(key, fn)
}

export function getFn<Task = Test | Custom>(key: Task): (() => Awaitable<void>) {
  return fnMap.get(key as any)
}

export function setFixture(key: TestContext, fixture: FixtureItem[] | undefined) {
  fixtureMap.set(key, fixture)
}

export function getFixture<Context = TestContext>(key: Context): FixtureItem[] {
  return fixtureMap.get(key as any)
}

export function setHooks(key: Suite, hooks: SuiteHooks) {
  hooksMap.set(key, hooks)
}

export function getHooks(key: Suite): SuiteHooks {
  return hooksMap.get(key)
}
