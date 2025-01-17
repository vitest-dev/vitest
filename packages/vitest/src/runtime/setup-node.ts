import type { ResolvedTestEnvironment } from '../types/environment'
import type { SerializedConfig } from './config'
import type { VitestExecutor } from './execute'
import { createRequire } from 'node:module'
import timers from 'node:timers'
import timersPromises from 'node:timers/promises'
import util from 'node:util'
import { getSafeTimers } from '@vitest/utils'
import { KNOWN_ASSET_TYPES } from 'vite-node/constants'
import { installSourcemapsSupport } from 'vite-node/source-map'
import { expect } from '../integrations/chai'
import { resolveSnapshotEnvironment } from '../integrations/snapshot/environments/resolveSnapshotEnvironment'
import * as VitestIndex from '../public/index'
import { setupCommonEnv } from './setup-common'
import { getWorkerState } from './utils'

// this should only be used in Node
let globalSetup = false
export async function setupGlobalEnv(
  config: SerializedConfig,
  { environment }: ResolvedTestEnvironment,
  executor: VitestExecutor,
) {
  await setupCommonEnv(config)

  Object.defineProperty(globalThis, '__vitest_index__', {
    value: VitestIndex,
    enumerable: false,
  })

  const state = getWorkerState()

  if (!state.config.snapshotOptions.snapshotEnvironment) {
    state.config.snapshotOptions.snapshotEnvironment
      = await resolveSnapshotEnvironment(config, executor)
  }

  if (globalSetup) {
    return
  }

  globalSetup = true

  if (environment.transformMode === 'web') {
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
    getSourceMap: source => state.moduleCache.getSourceMap(source),
  })

  if (!config.disableConsoleIntercept) {
    await setupConsoleLogSpy()
  }
}

function resolveCss(mod: NodeJS.Module) {
  mod.exports = ''
}

function resolveAsset(mod: NodeJS.Module, url: string) {
  mod.exports = url
}

export async function setupConsoleLogSpy() {
  const { createCustomConsole } = await import('./console')

  globalThis.console = createCustomConsole()
}

export async function withEnv(
  { environment }: ResolvedTestEnvironment,
  options: Record<string, any>,
  fn: () => Promise<void>,
) {
  // @ts-expect-error untyped global
  globalThis.__vitest_environment__ = environment.name
  expect.setState({
    environment: environment.name,
  })
  const env = await environment.setup(globalThis, options)
  try {
    await fn()
  }
  finally {
    // Run possible setTimeouts, e.g. the onces used by ConsoleLogSpy
    const { setTimeout } = getSafeTimers()
    await new Promise(resolve => setTimeout(resolve))

    await env.teardown(globalThis)
  }
}
