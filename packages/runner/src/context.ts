import type { Awaitable } from '@vitest/utils'
import { getSafeTimers } from '@vitest/utils'
import type { RuntimeContext, SuiteCollector, Test, TestContext } from './types'
import type { VitestRunner } from './types/runner'

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

export function withTimeout<T extends((...args: any[]) => any)>(
  fn: T,
  timeout: number,
  isHook = false,
): T {
  if (timeout <= 0 || timeout === Infinity)
    return fn

  const { setTimeout, clearTimeout } = getSafeTimers()

  return ((...args: (T extends ((...args: infer A) => any) ? A : never)) => {
    return Promise.race([fn(...args), new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        clearTimeout(timer)
        reject(new Error(makeTimeoutMsg(isHook, timeout)))
      }, timeout)
      // `unref` might not exist in browser
      timer.unref?.()
    })]) as Awaitable<void>
  }) as T
}

export function createTestContext(test: Test, runner: VitestRunner): TestContext {
  const context = function () {
    throw new Error('done() callback is deprecated, use promise instead')
  } as unknown as TestContext

  context.meta = test

  context.onTestFailed = (fn) => {
    test.onFailed ||= []
    test.onFailed.push(fn)
  }

  return runner.extendTestContext?.(context) || context
}

function makeTimeoutMsg(isHook: boolean, timeout: number) {
  return `${isHook ? 'Hook' : 'Test'} timed out in ${timeout}ms.\nIf this is a long-running ${isHook ? 'hook' : 'test'}, pass a timeout value as the last argument or configure it globally with "${isHook ? 'hookTimeout' : 'testTimeout'}".`
}
