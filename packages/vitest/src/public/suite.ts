export { getBenchFn, getBenchOptions } from '../runtime/benchmark'
export {
  createTaskCollector,
  getCurrentSuite,
  getCurrentTest,
  getFn,
  getHooks,
  setFn,
  setHooks,
} from '@vitest/runner'
export type { VitestRunner, VitestRunnerConfig } from '@vitest/runner'
export { createChainable } from '@vitest/runner/utils'

process.emitWarning('Importing from "vitest/suite" is deprecated since Vitest 4.1. Please use "vitest/runtime" instead.', 'DeprecationWarning')
