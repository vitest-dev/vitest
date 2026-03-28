import type { Awaitable } from '@vitest/utils'
import type { TestFixtures } from './fixture'
import type { BenchManager, Suite, SuiteHooks, Test, TestContext } from './types/tasks'

// use WeakMap here to make the Test and Suite object serializable
const fnMap = new WeakMap()
const testFixtureMap = new WeakMap()
const hooksMap = new WeakMap()
const benchManagers = new WeakMap<Test, BenchManager[]>()

export function setFn(key: Test, fn: () => Awaitable<void>): void {
  fnMap.set(key, fn)
}

export function getFn<Task = Test>(key: Task): () => Awaitable<void> {
  return fnMap.get(key as any)
}

export function addBenchManager(key: Test, manager: BenchManager): void {
  if (!benchManagers.has(key)) {
    benchManagers.set(key, [])
  }
  benchManagers.get(key)!.push(manager)
}

export function getBenchManagers(key: Test): BenchManager[] {
  return benchManagers.get(key) || []
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
