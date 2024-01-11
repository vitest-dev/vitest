import type { OnTestFailedHandler, SuiteHooks, TaskPopulated } from './types'
import { getCurrentSuite, getRunner } from './suite'
import { getCurrentTest } from './test-state'
import { withTimeout } from './context'
import { withFixtures } from './fixture'

function getDefaultHookTimeout() {
  return getRunner().config.hookTimeout
}

// suite hooks
export function beforeAll(fn: SuiteHooks['beforeAll'][0], timeout?: number) {
  return getCurrentSuite().on('beforeAll', withTimeout(fn, timeout ?? getDefaultHookTimeout(), true))
}
export function afterAll(fn: SuiteHooks['afterAll'][0], timeout?: number) {
  return getCurrentSuite().on('afterAll', withTimeout(fn, timeout ?? getDefaultHookTimeout(), true))
}
export function beforeEach<ExtraContext = {}>(fn: SuiteHooks<ExtraContext>['beforeEach'][0], timeout?: number) {
  return getCurrentSuite<ExtraContext>().on('beforeEach', withTimeout(withFixtures(fn), timeout ?? getDefaultHookTimeout(), true))
}
export function afterEach<ExtraContext = {}>(fn: SuiteHooks<ExtraContext>['afterEach'][0], timeout?: number) {
  return getCurrentSuite<ExtraContext>().on('afterEach', withTimeout(withFixtures(fn), timeout ?? getDefaultHookTimeout(), true))
}

export const onTestFailed = createTestHook<OnTestFailedHandler>('onTestFailed', (test, handler) => {
  test.onFailed ||= []
  test.onFailed.push(handler)
})

function createTestHook<T>(name: string, handler: (test: TaskPopulated, handler: T) => void) {
  return (fn: T) => {
    const current = getCurrentTest()

    if (!current)
      throw new Error(`Hook ${name}() can only be called inside a test`)

    handler(current, fn)
  }
}
