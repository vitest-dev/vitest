import { isatty } from 'node:tty'
import { createRequire } from 'node:module'
import { startTests } from '@vitest/runner'
import { createColors, setupColors } from '@vitest/utils'
import { setupChaiConfig } from '../integrations/chai'
import { startCoverageInsideWorker, stopCoverageInsideWorker } from '../integrations/coverage'
import type { ContextTestEnvironment, ResolvedConfig } from '../types'
import { getWorkerState } from '../utils/global'
import type { VitestExecutor } from './execute'
import { resolveTestRunner } from './runners'
import { setupCommonEnv } from './setup.common'

export async function run(files: string[], config: ResolvedConfig, environment: ContextTestEnvironment, executor: VitestExecutor): Promise<void> {
  const workerState = getWorkerState()

  process.stdout.write(`worker state ${workerState.filepath}\n`)

  await setupCommonEnv(config)

  setupColors(createColors(isatty(1)))

  const _require = createRequire(import.meta.url)
  // always mock "required" `css` files, because we cannot process them
  _require.extensions['.css'] = () => ({})
  _require.extensions['.scss'] = () => ({})
  _require.extensions['.sass'] = () => ({})

  Error.stackTraceLimit = 1000

  await startCoverageInsideWorker(config.coverage, executor)

  if (config.chaiConfig)
    setupChaiConfig(config.chaiConfig)

  const runner = await resolveTestRunner(config, executor)

  for (const file of files) {
    workerState.filepath = file

    await startTests([file], runner)

    workerState.filepath = undefined
  }

  await stopCoverageInsideWorker(config.coverage, executor)
}
