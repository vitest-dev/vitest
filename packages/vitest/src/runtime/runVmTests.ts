import type { FileSpecification } from '@vitest/runner'
import type { SerializedConfig } from './config'
import type { VitestExecutor } from './execute'
import { createRequire } from 'node:module'
import { performance } from 'node:perf_hooks'
import timers from 'node:timers'
import timersPromises from 'node:timers/promises'
import util from 'node:util'
import { collectTests, startTests } from '@vitest/runner'
import { KNOWN_ASSET_TYPES } from 'vite-node/constants'
import { installSourcemapsSupport } from 'vite-node/source-map'
import { setupChaiConfig } from '../integrations/chai/config'
import {
  startCoverageInsideWorker,
  stopCoverageInsideWorker,
} from '../integrations/coverage'
import { resolveSnapshotEnvironment } from '../integrations/snapshot/environments/resolveSnapshotEnvironment'
import * as VitestIndex from '../public/index'
import { closeInspector } from './inspector'
import { resolveTestRunner } from './runners'
import { setupCommonEnv } from './setup-common'
import { getWorkerState } from './utils'

export async function run(
  method: 'run' | 'collect',
  files: FileSpecification[],
  config: SerializedConfig,
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
    _require.extensions['.css'] = resolveCss
    _require.extensions['.scss'] = resolveCss
    _require.extensions['.sass'] = resolveCss
    _require.extensions['.less'] = resolveCss
    // since we are using Vite, we can assume how these will be resolved
    KNOWN_ASSET_TYPES.forEach((type) => {
      _require.extensions[`.${type}`] = resolveAsset
    })
    process.env.SSR = ''
  }
  else {
    process.env.SSR = '1'
  }

  // @ts-expect-error not typed global for patched timers
  globalThis.__vitest_required__ = {
    util,
    timers,
    timersPromises,
  }

  installSourcemapsSupport({
    getSourceMap: source => workerState.moduleCache.getSourceMap(source),
  })

  await startCoverageInsideWorker(config.coverage, executor, { isolate: false })

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
    workerState.filepath = file.filepath

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

  await stopCoverageInsideWorker(config.coverage, executor, { isolate: false })
}

function resolveCss(mod: NodeJS.Module) {
  mod.exports = ''
}

function resolveAsset(mod: NodeJS.Module, url: string) {
  mod.exports = url
}
