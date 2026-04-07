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

console.warn('Importing from "vitest/suite" is deprecated since Vitest 4.1. Please use static methods of "TestRunner" from the "vitest" entry point instead: e.g., `TestRunner.getCurrentTest()`.')
