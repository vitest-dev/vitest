import type { FileSpecification } from '@vitest/runner'
import type { Traces } from '../utils/traces'
import type { SerializedConfig } from './config'
import type { TestModuleRunner } from './moduleRunner/testModuleRunner'
import { createRequire } from 'node:module'
import { performance } from 'node:perf_hooks'
import timers from 'node:timers'
import timersPromises from 'node:timers/promises'
import util from 'node:util'
import { collectTests, startTests } from '@vitest/runner'
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

  workerState.onCancel((reason) => {
    closeInspector(config)
    testRunner.cancel?.(reason)
  })

  workerState.durations.prepare
    = performance.now() - workerState.durations.prepare

  const { vi } = VitestIndex

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

  await traces.$('vitest.runtime.coverage.stop', () => stopCoverageInsideWorker(config.coverage, moduleRunner, { isolate: false }))
}

function resolveCss(mod: NodeJS.Module) {
  mod.exports = ''
}

function resolveAsset(mod: NodeJS.Module, url: string) {
  mod.exports = url
}
