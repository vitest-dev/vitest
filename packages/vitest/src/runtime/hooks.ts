import type { SuiteHooks } from '../types'
import { getDefaultHookTimeout, withTimeout } from './context'
import { getCurrentSuite } from './suite'

// suite hooks
export const beforeAll = (fn: SuiteHooks['beforeAll'][0], timeout?: number) => getCurrentSuite().on('beforeAll', withTimeout(fn, timeout ?? getDefaultHookTimeout(), true))
export const afterAll = (fn: SuiteHooks['afterAll'][0], timeout?: number) => getCurrentSuite().on('afterAll', withTimeout(fn, timeout ?? getDefaultHookTimeout(), true))
export const beforeEach = <ExtraContext = {}>(fn: SuiteHooks<ExtraContext>['beforeEach'][0], timeout?: number) => getCurrentSuite<ExtraContext>().on('beforeEach', withTimeout(fn, timeout ?? getDefaultHookTimeout(), true))
export const afterEach = <ExtraContext = {}>(fn: SuiteHooks<ExtraContext>['afterEach'][0], timeout?: number) => getCurrentSuite<ExtraContext>().on('afterEach', withTimeout(fn, timeout ?? getDefaultHookTimeout(), true))
