import { VitestModuleEvaluator } from '../runtime/moduleRunner/moduleEvaluator'
// #region internal
import { VitestModuleRunner } from '../runtime/moduleRunner/moduleRunner'
import {
  startVitestModuleRunner,
  VITEST_VM_CONTEXT_SYMBOL,
} from '../runtime/moduleRunner/startModuleRunner'
import { getWorkerState } from '../runtime/utils'
// #endregion

export { environments as builtinEnvironments } from '../integrations/env/index'
export { populateGlobal } from '../integrations/env/utils'
export { VitestNodeSnapshotEnvironment as VitestSnapshotEnvironment } from '../integrations/snapshot/environments/node'
export { getBenchFn, getBenchOptions } from '../runtime/benchmark'
export { NodeBenchmarkRunner } from '../runtime/runners/benchmark'
export { VitestTestRunner } from '../runtime/runners/test'
export type {
  Environment,
  EnvironmentReturn,
  VmEnvironmentReturn,
} from '../types/environment'
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
export type { SnapshotEnvironment } from '@vitest/snapshot/environment'

// #region internal
/**
 * @internal
 */
export interface __TYPES {
  VitestModuleRunner: VitestModuleRunner
}
/**
 * @internal
 */
export const __INTERNAL: {
  VitestModuleEvaluator: typeof VitestModuleEvaluator
  startVitestModuleRunner: typeof startVitestModuleRunner
  VITEST_VM_CONTEXT_SYMBOL: typeof VITEST_VM_CONTEXT_SYMBOL
  getWorkerState: typeof getWorkerState
} = {
  VitestModuleEvaluator,
  VitestModuleRunner,
  startVitestModuleRunner,
  VITEST_VM_CONTEXT_SYMBOL,
  getWorkerState,
} as any
// #endregion
