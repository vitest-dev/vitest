import type { Traces } from '../utils/traces'
import type { SerializedConfig } from './config'
import type { TestModuleRunner } from './moduleRunner/testModuleRunner'
import type { FileSpecification } from './runner/types'
import { createRequire } from 'node:module'
import { performance } from 'node:perf_hooks'
import timers from 'node:timers'
import timersPromises from 'node:timers/promises'
import util from 'node:util'
import { KNOWN_ASSET_TYPES } from '@vitest/utils/constants'
import { setupChaiConfig } from '../integrations/chai/config'
import {
  startCoverageInsideWorker,
  stopCoverageInsideWorker,
} from '../integrations/coverage'
import { resolveSnapshotEnvironment } from '../integrations/snapshot/environments/resolveSnapshotEnvironment'
import * as VitestIndex from '../public/index'
import { detectAsyncLeaks } from './detect-async-leaks'
import { closeInspector } from './inspector'
import { collectTests, startTests } from './runner/run'
import { resolveTestRunner } from './runners'
import { setupCommonEnv } from './setup-common'
import { getWorkerState } from './utils'

export async function run(
  method: 'run' | 'collect',
  files: FileSpecification[],
  config: SerializedConfig,
  moduleRunner: TestModuleRunner,
  traces: Traces,
): Promise<void> {
  const workerState = getWorkerState()

  await traces.$('vitest.runtime.global_env', () => setupCommonEnv(config))

  Object.defineProperty(globalThis, '__vitest_index__', {
    value: VitestIndex,
    enumerable: false,
    configurable: true,
    writable: true,
  })

  const viteEnvironment = workerState.environment.viteEnvironment || workerState.environment.name
  VitestIndex.expect.setState({
    environment: workerState.environment.name,
  })
  if (viteEnvironment === 'client') {
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

  await traces.$('vitest.runtime.coverage.start', () => startCoverageInsideWorker(config.coverage, moduleRunner, { isolate: false }))

  if (config.chaiConfig) {
    setupChaiConfig(config.chaiConfig)
  }

  const [testRunner, snapshotEnvironment] = await Promise.all([
    traces.$('vitest.runtime.runner', () => resolveTestRunner(config, moduleRunner, traces)),
    traces.$('vitest.runtime.snapshot.environment', () => resolveSnapshotEnvironment(config, moduleRunner)),
  ])

  config.snapshotOptions.snapshotEnvironment = snapshotEnvironment

  // the callback captures this file's runner: unsubscribe once the run is
  // over, or every finished file's world stays reachable from the worker's
  // cancel listeners for the lifetime of the worker
  const offCancel = workerState.onCancel((reason) => {
    closeInspector(config)
    testRunner.cancel?.(reason)
  })

  // unlike other pools, the vm pool creates the environment inside the
  // prepare window; subtract it so `prepare` excludes the environment
  // load time in every pool
  workerState.durations.prepare
    = performance.now() - workerState.durations.prepare - workerState.durations.environment

  const { vi } = VitestIndex

  try {
    await traces.$(
      `vitest.test.runner.${method}`,
      async () => {
        for (const file of files) {
          workerState.filepath = file.filepath

          if (method === 'run') {
            const collectAsyncLeaks = config.detectAsyncLeaks ? detectAsyncLeaks(file.filepath, workerState.ctx.projectName) : undefined

            await traces.$(
              `vitest.test.runner.${method}.module`,
              { attributes: { 'code.file.path': file.filepath } },
              () => startTests([file], testRunner),
            )

            const leaks = await collectAsyncLeaks?.()

            if (leaks?.length) {
              workerState.rpc.onAsyncLeaks(leaks)
            }
          }
          else {
            await traces.$(
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
  }
  finally {
    offCancel()
  }

  await traces.$('vitest.runtime.coverage.stop', () => stopCoverageInsideWorker(config.coverage, moduleRunner, { isolate: false }))
}

function resolveCss(mod: NodeJS.Module) {
  mod.exports = ''
}

function resolveAsset(mod: NodeJS.Module, url: string) {
  mod.exports = url
}
