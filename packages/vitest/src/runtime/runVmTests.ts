import { createRequire } from 'node:module'
import util from 'node:util'
import timers from 'node:timers'
import { performance } from 'node:perf_hooks'
import { collectTests, startTests } from '@vitest/runner'
import { installSourcemapsSupport } from 'vite-node/source-map'
import { setupChaiConfig } from '../integrations/chai/config'
import {
  startCoverageInsideWorker,
  stopCoverageInsideWorker,
} from '../integrations/coverage'
import type { ResolvedConfig } from '../types'
import { getWorkerState } from '../utils/global'
import * as VitestIndex from '../index'
import { resolveSnapshotEnvironment } from '../integrations/snapshot/environments/resolveSnapshotEnvironment'
import type { VitestExecutor } from './execute'
import { resolveTestRunner } from './runners'
import { setupCommonEnv } from './setup-common'
import { closeInspector } from './inspector'

export async function run(
  method: 'run' | 'collect',
  files: string[],
  config: ResolvedConfig,
  executor: VitestExecutor,
): Promise<void> {
  const workerState = getWorkerState()

  await setupCommonEnv(config)

  Object.defineProperty(globalThis, '__vitest_index__', {
    value: VitestIndex,
    enumerable: false,
  })

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

  installSourcemapsSupport({
    getSourceMap: source => workerState.moduleCache.getSourceMap(source),
  })

  await startCoverageInsideWorker(config.coverage, executor)

  if (config.chaiConfig) {
    setupChaiConfig(config.chaiConfig)
  }

  const [runner, snapshotEnvironment] = await Promise.all([
    resolveTestRunner(config, executor),
    resolveSnapshotEnvironment(config, executor),
  ])

  config.snapshotOptions.snapshotEnvironment = snapshotEnvironment

  workerState.onCancel.then((reason) => {
    closeInspector(config)
    runner.onCancel?.(reason)
  })

  workerState.durations.prepare
    = performance.now() - workerState.durations.prepare

  const { vi } = VitestIndex

  for (const file of files) {
    workerState.filepath = file

    if (method === 'run') {
      await startTests([file], runner)
    }
    else {
      await collectTests([file], runner)
    }

    // reset after tests, because user might call `vi.setConfig` in setupFile
    vi.resetConfig()
    // mocks should not affect different files
    vi.restoreAllMocks()
  }

  await stopCoverageInsideWorker(config.coverage, executor)
}
