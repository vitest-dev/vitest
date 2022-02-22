import type { Awaitable, RuntimeContext, SuiteCollector, Test, TestContext, TestFunction } from '../types'
import { expect } from '../integrations/chai'

export const collectorContext: RuntimeContext = {
  tasks: [],
  currentSuite: null,
}

export function collectTask(task: SuiteCollector) {
  collectorContext.currentSuite?.tasks.push(task)
}

export async function runWithSuite(suite: SuiteCollector, fn: (() => Awaitable<void>)) {
  const prev = collectorContext.currentSuite
  collectorContext.currentSuite = suite
  await fn()
  collectorContext.currentSuite = prev
}

export function getDefaultTestTimeout() {
  return __vitest_worker__!.config!.testTimeout
}

export function getDefaultHookTimeout() {
  return __vitest_worker__!.config!.hookTimeout
}

export function withTimeout<T extends((...args: any[]) => any)>(fn: T, _timeout?: number): T {
  const timeout = _timeout ?? getDefaultTestTimeout()
  if (timeout <= 0 || timeout === Infinity)
    return fn

  return ((...args: (T extends ((...args: infer A) => any) ? A : never)) => {
    return Promise.race([fn(...args), new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        clearTimeout(timer)
        reject(new Error(`Test timed out in ${timeout}ms.`))
      }, timeout)
      timer.unref()
    })]) as Awaitable<void>
  }) as T
}

function createTestContext(test: Test): TestContext {
  const context = (() => {
    throw new Error('done() callback is deperated, use promise instead')
  }) as unknown as TestContext
  context.meta = test
  // TODO: @antfu use a getter to create new expect instance that bound to the test for concurrent tests
  context.expect = expect

  return context
}

export function normalizeTest(fn: TestFunction, test: Test, timeout?: number): () => Awaitable<void> {
  return withTimeout(
    () => fn(createTestContext(test)),
    timeout,
  )
}
