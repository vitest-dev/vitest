import type { Awaitable } from '@vitest/utils'
import type { FixtureItem } from './fixture'
import type { Suite, SuiteHooks, Test, TestContext } from './types/tasks'

// use WeakMap here to make the Test and Suite object serializable
const fnMap = new WeakMap()
const testFixtureMap = new WeakMap()
const hooksMap = new WeakMap()

export function setFn(key: Test, fn: () => Awaitable<void>): void {
  fnMap.set(key, fn)
}

export function getFn<Task = Test>(key: Task): () => Awaitable<void> {
  return fnMap.get(key as any)
}

export function setTestFixture(
  key: TestContext,
  fixture: FixtureItem[] | undefined,
): void {
  testFixtureMap.set(key, fixture)
}

export function getTestFixture<Context = TestContext>(key: Context): FixtureItem[] {
  return testFixtureMap.get(key as any)
}

export function setHooks(key: Suite, hooks: SuiteHooks): void {
  hooksMap.set(key, hooks)
}

export function getHooks(key: Suite): SuiteHooks {
  return hooksMap.get(key)
}
