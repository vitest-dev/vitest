export {
  startCoverageInsideWorker,
  stopCoverageInsideWorker,
  takeCoverageInsideWorker,
} from '../integrations/coverage'

export {
  loadDiffConfig,
  loadSnapshotSerializers,
  setupCommonEnv,
} from '../runtime/setup-common'
export { collectTests, processError, startTests } from '@vitest/runner'
export * as SpyModule from '@vitest/spy'
