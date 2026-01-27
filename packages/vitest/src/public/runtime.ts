// #region internal
import type { TestModuleRunner } from '../runtime/moduleRunner/testModuleRunner'
import { VitestModuleEvaluator } from '../runtime/moduleRunner/moduleEvaluator'
import { VitestModuleRunner } from '../runtime/moduleRunner/moduleRunner'
import {
  startVitestModuleRunner,
  VITEST_VM_CONTEXT_SYMBOL,
} from '../runtime/moduleRunner/startVitestModuleRunner'
import { getWorkerState } from '../runtime/utils'
// #endregion

export { environments as builtinEnvironments } from '../integrations/env/index'
export { populateGlobal } from '../integrations/env/utils'
export { VitestNodeSnapshotEnvironment as VitestSnapshotEnvironment } from '../integrations/snapshot/environments/node'
export type {
  Environment,
  EnvironmentReturn,
  VmEnvironmentReturn,
} from '../types/environment'
export type { VitestRunner, VitestRunnerConfig } from '@vitest/runner'
export type { SnapshotEnvironment } from '@vitest/snapshot/environment'

// #region internal
/**
 * @internal
 */
export interface __TYPES {
  VitestModuleRunner: VitestModuleRunner
  TestModuleRunner: TestModuleRunner
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
