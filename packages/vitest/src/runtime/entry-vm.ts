import { isatty } from 'node:tty'
import { createRequire } from 'node:module'
import util from 'node:util'
import timers from 'node:timers'
import { performance } from 'node:perf_hooks'
import { startTests } from '@vitest/runner'
import { createColors, setupColors } from '@vitest/utils'
import { setupChaiConfig } from '../integrations/chai/config'
import { startCoverageInsideWorker, stopCoverageInsideWorker } from '../integrations/coverage'
import type { ResolvedConfig } from '../types'
import { getWorkerState } from '../utils/global'
import { VitestSnapshotEnvironment } from '../integrations/snapshot/environments/node'
import * as VitestIndex from '../index'
import type { VitestExecutor } from './execute'
import { resolveTestRunner } from './runners'
import { setupCommonEnv } from './setup-common'

export async function run(files: string[], config: ResolvedConfig, executor: VitestExecutor): Promise<void> {
  const workerState = getWorkerState()

  await setupCommonEnv(config)

  Object.defineProperty(globalThis, '__vitest_index__', {
    value: VitestIndex,
    enumerable: false,
  })

  config.snapshotOptions.snapshotEnvironment = new VitestSnapshotEnvironment(workerState.rpc)

  setupColors(createColors(isatty(1)))

  if (workerState.environment.transformMode === 'web') {
    const _require = createRequire(import.meta.url)
    // always mock "required" `css` files, because we cannot process them
    _require.extensions['.css'] = () => ({})
    _require.extensions['.scss'] = () => ({})
    _require.extensions['.sass'] = () => ({})
    _require.extensions['.less'] = () => ({})
  }

  // @ts-expect-error not typed global for patched timers
  globalThis.__vitest_required__ = {
    util,
    timers,
  }

  await startCoverageInsideWorker(config.coverage, executor)

  if (config.chaiConfig)
    setupChaiConfig(config.chaiConfig)

  const runner = await resolveTestRunner(config, executor)

  workerState.durations.prepare = performance.now() - workerState.durations.prepare

  for (const file of files) {
    workerState.filepath = file

    await startTests([file], runner)

    workerState.filepath = undefined
  }

  await stopCoverageInsideWorker(config.coverage, executor)
}
