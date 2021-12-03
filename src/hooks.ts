import { createHook } from './utils/hook'
import { File, Suite, Task } from './types'

export const beforeAllHook = createHook()
export const afterAllHook = createHook()
export const beforeEachHook = createHook<[Task]>()
export const afterEachHook = createHook<[Task]>()
export const beforeFileHook = createHook<[File]>()
export const afterFileHook = createHook<[File]>()
export const beforeSuiteHook = createHook<[Suite]>()
export const afterSuiteHook = createHook<[Suite]>()

export const beforeAll = beforeAllHook.on
export const afterAll = afterAllHook.on
export const beforeEach = beforeEachHook.on
export const afterEach = afterEachHook.on
export const beforeFile = beforeFileHook.on
export const afterFile = afterFileHook.on
export const beforeSuite = beforeSuiteHook.on
export const afterSuite = afterSuiteHook.on
