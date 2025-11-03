import type { FileSpecification } from '@vitest/runner'
import type { Environment } from '../types/environment'
import type { SerializedConfig } from './config'
import type { VitestModuleRunner } from './moduleRunner/moduleRunner'
import { performance } from 'node:perf_hooks'
import { collectTests, startTests } from '@vitest/runner'
import {
  startCoverageInsideWorker,
  stopCoverageInsideWorker,
} from '../integrations/coverage'
import { resolveSnapshotEnvironment } from '../integrations/snapshot/environments/resolveSnapshotEnvironment'
import { vi } from '../integrations/vi'
import { closeInspector } from './inspector'
import { resolveTestRunner } from './runners'
import { setupGlobalEnv } from './setup-node'
import { getWorkerState, resetModules } from './utils'

// browser shouldn't call this!
export async function run(
  method: 'run' | 'collect',
  files: FileSpecification[],
  config: SerializedConfig,
  moduleRunner: VitestModuleRunner,
  environment: Environment,
): Promise<void> {
  const workerState = getWorkerState()

  const [testRunner] = await Promise.all([
    resolveTestRunner(config, moduleRunner),
    setupGlobalEnv(config, environment),
    startCoverageInsideWorker(config.coverage, moduleRunner, { isolate: config.isolate }),
    (async () => {
      if (!workerState.config.snapshotOptions.snapshotEnvironment) {
        workerState.config.snapshotOptions.snapshotEnvironment
          = await resolveSnapshotEnvironment(config, moduleRunner)
      }
    })(),
  ])

  workerState.onCancel((reason) => {
    closeInspector(config)
    testRunner.cancel?.(reason)
  })

  workerState.durations.prepare = performance.now() - workerState.durations.prepare

  for (const file of files) {
    if (config.isolate) {
      moduleRunner.mocker.reset()
      resetModules(workerState.evaluatedModules, true)
    }

    workerState.filepath = file.filepath

    if (method === 'run') {
      await startTests([file], testRunner)
    }
    else {
      await collectTests([file], testRunner)
    }

    // reset after tests, because user might call `vi.setConfig` in setupFile
    vi.resetConfig()
    // mocks should not affect different files
    vi.restoreAllMocks()
  }

  await stopCoverageInsideWorker(config.coverage, moduleRunner, { isolate: config.isolate })
}
