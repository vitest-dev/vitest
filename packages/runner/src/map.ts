import type { Awaitable } from '@vitest/utils'
import type { TestFixtures } from './fixture'
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
  fixture: TestFixtures,
): void {
  testFixtureMap.set(key, fixture)
}

export function getTestFixtures<Context = TestContext>(key: Context): TestFixtures {
  return testFixtureMap.get(key as any)
}

export function setHooks(key: Suite, hooks: SuiteHooks): void {
  hooksMap.set(key, hooks)
}

export function getHooks(key: Suite): SuiteHooks {
  return hooksMap.get(key)
}
