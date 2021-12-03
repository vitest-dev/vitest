import { createHook } from './utils/hook'
import { Suite, Task } from './types'
import { TaskResult } from '.'

export const beforeHook = createHook()
export const afterHook = createHook()
export const beforeEachHook = createHook<[Task]>()
export const afterEachHook = createHook<[Task, TaskResult]>()
export const beforeFileHook = createHook<[string]>()
export const afterFileHook = createHook<[string]>()
export const beforeSuiteHook = createHook<[Suite]>()
export const afterSuiteHook = createHook<[Suite]>()

export const before = beforeHook.on
export const after = afterHook.on
export const beforeEach = beforeEachHook.on
export const afterEach = afterEachHook.on
export const beforeFile = beforeFileHook.on
export const afterFile = afterFileHook.on
export const beforeSuite = beforeSuiteHook.on
export const afterSuite = afterSuiteHook.on
