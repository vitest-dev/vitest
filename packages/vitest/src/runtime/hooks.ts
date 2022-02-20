import type { SuiteHooks } from '../types'
import { getDefaultHookTimeout, withTimeout } from './context'
import { getCurrentSuite } from './suite'

// suite hooks
export const beforeAll = (fn: SuiteHooks['beforeAll'][0], timeout?: number) => getCurrentSuite().on('beforeAll', withTimeout(fn, { isHook: true, _timeout: timeout ?? getDefaultHookTimeout() }))
export const afterAll = (fn: SuiteHooks['afterAll'][0], timeout?: number) => getCurrentSuite().on('afterAll', withTimeout(fn, { isHook: true, _timeout: timeout ?? getDefaultHookTimeout() }))
export const beforeEach = (fn: SuiteHooks['beforeEach'][0], timeout?: number) => getCurrentSuite().on('beforeEach', withTimeout(fn, { isHook: true, _timeout: timeout ?? getDefaultHookTimeout() }))
export const afterEach = (fn: SuiteHooks['afterEach'][0], timeout?: number) => getCurrentSuite().on('afterEach', withTimeout(fn, { isHook: true, _timeout: timeout ?? getDefaultHookTimeout() }))
