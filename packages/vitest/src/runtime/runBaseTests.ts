import type { FileSpecification } from '@vitest/runner'
import type { Environment } from '../types/environment'
import type { Traces } from '../utils/traces'
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
  otel: Traces,
): Promise<void> {
  const workerState = getWorkerState()

  const [testRunner] = await Promise.all([
    otel.$('vitest.runtime.runner', () => resolveTestRunner(config, moduleRunner, otel)),
    otel.$('vitest.runtime.global_env', () => setupGlobalEnv(config, environment)),
    otel.$('vitest.runtime.coverage.start', () => startCoverageInsideWorker(config.coverage, moduleRunner, { isolate: config.isolate })),
    otel.$('vitest.runtime.snapshot.environment', async () => {
      if (!workerState.config.snapshotOptions.snapshotEnvironment) {
        workerState.config.snapshotOptions.snapshotEnvironment
          = await resolveSnapshotEnvironment(config, moduleRunner)
      }
    }),
  ])

  workerState.onCancel((reason) => {
    closeInspector(config)
    testRunner.cancel?.(reason)
  })

  workerState.durations.prepare = performance.now() - workerState.durations.prepare
  await otel.$(
    `vitest.test.runner.${method}`,
    async () => {
      for (const file of files) {
        if (config.isolate) {
          moduleRunner.mocker.reset()
          resetModules(workerState.evaluatedModules, true)
        }

        workerState.filepath = file.filepath

        if (method === 'run') {
          await otel.$(
            `vitest.test.runner.${method}.module`,
            { attributes: { 'code.file.path': file.filepath } },
            () => startTests([file], testRunner),
          )
        }
        else {
          await otel.$(
            `vitest.test.runner.${method}.module`,
            { attributes: { 'code.file.path': file.filepath } },
            () => collectTests([file], testRunner),
          )
        }

        // reset after tests, because user might call `vi.setConfig` in setupFile
        vi.resetConfig()
        // mocks should not affect different files
        vi.restoreAllMocks()
      }
    },
  )

  await otel.$('vitest.runtime.coverage.stop', () => stopCoverageInsideWorker(config.coverage, moduleRunner, { isolate: config.isolate }))
}
