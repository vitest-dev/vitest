import type { OnTestFailedHandler, SuiteHooks, Test } from '../types'
import { getDefaultHookTimeout, withTimeout } from './context'
import { getCurrentSuite } from './suite'
import { getCurrentTest } from './test-state'

// suite hooks
export const beforeAll = (fn: SuiteHooks['beforeAll'][0], timeout?: number) => getCurrentSuite().on('beforeAll', withTimeout(fn, timeout ?? getDefaultHookTimeout(), true))
export const afterAll = (fn: SuiteHooks['afterAll'][0], timeout?: number) => getCurrentSuite().on('afterAll', withTimeout(fn, timeout ?? getDefaultHookTimeout(), true))
export const beforeEach = <ExtraContext = {}>(fn: SuiteHooks<ExtraContext>['beforeEach'][0], timeout?: number) => getCurrentSuite<ExtraContext>().on('beforeEach', withTimeout(fn, timeout ?? getDefaultHookTimeout(), true))
export const afterEach = <ExtraContext = {}>(fn: SuiteHooks<ExtraContext>['afterEach'][0], timeout?: number) => getCurrentSuite<ExtraContext>().on('afterEach', withTimeout(fn, timeout ?? getDefaultHookTimeout(), true))

export const onTestFailed = createTestHook<OnTestFailedHandler>('onTestFailed', (test, handler) => {
  test.onFailed ||= []
  test.onFailed.push(handler)
})

function createTestHook<T>(name: string, handler: (test: Test, handler: T) => void) {
  return (fn: T) => {
    const current = getCurrentTest()

    if (!current)
      throw new Error(`Hook ${name}() can only be called inside a test`)

    handler(current, fn)
  }
}
