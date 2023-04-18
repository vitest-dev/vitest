import { startTests } from '@vitest/runner'
import { setupChaiConfig } from '../integrations/chai'
import { startCoverageInsideWorker, stopCoverageInsideWorker } from '../integrations/coverage'
import type { ContextTestEnvironment, ResolvedConfig } from '../types'
import { getWorkerState } from '../utils/global'
import type { VitestExecutor } from './execute'
import { resolveTestRunner } from './runners'
import { setupCommonEnv } from './setup.common'

export async function run(files: string[], config: ResolvedConfig, environment: ContextTestEnvironment, executor: VitestExecutor): Promise<void> {
  const workerState = getWorkerState()

  await setupCommonEnv(config)
  await startCoverageInsideWorker(config.coverage, executor)

  if (config.chaiConfig)
    setupChaiConfig(config.chaiConfig)

  const runner = await resolveTestRunner(config, executor)

  // workerState.durations.prepare = performance.now() - workerState.durations.prepare

  await startTests(files, runner)

  await stopCoverageInsideWorker(config.coverage, executor)

  workerState.environmentTeardownRun = true
}
