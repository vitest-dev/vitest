import type { Awaitable, RuntimeContext, SuiteCollector, Test, TestContext } from '../types'
import { createExpect } from '../integrations/chai'
import { clearTimeout, getWorkerState, setTimeout } from '../utils'

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
  return getWorkerState().config.testTimeout
}

export function getDefaultHookTimeout() {
  return getWorkerState().config.hookTimeout
}

export function withTimeout<T extends((...args: any[]) => any)>(
  fn: T,
  timeout = getDefaultTestTimeout(),
  isHook = false,
): T {
  if (timeout <= 0 || timeout === Infinity)
    return fn

  return ((...args: (T extends ((...args: infer A) => any) ? A : never)) => {
    return Promise.race([fn(...args), new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        clearTimeout(timer)
        reject(new Error(makeTimeoutMsg(isHook, timeout)))
      }, timeout)
      timer.unref()
    })]) as Awaitable<void>
  }) as T
}

export function createTestContext(test: Test): TestContext {
  const context = function () {
    throw new Error('done() callback is deperated, use promise instead')
  } as unknown as TestContext

  context.meta = test
  context.expect = createExpect(test)

  return context
}

function makeTimeoutMsg(isHook: boolean, timeout: number) {
  return `${isHook ? 'Hook' : 'Test'} timed out in ${timeout}ms.\nIf this is a long-running test, pass a timeout value as the last argument or configure it globally with "${isHook ? 'hookTimeout' : 'testTimeout'}".`
}
