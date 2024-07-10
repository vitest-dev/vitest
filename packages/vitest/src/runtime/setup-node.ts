import { createRequire } from 'node:module'
import util from 'node:util'
import timers from 'node:timers'
import { installSourcemapsSupport } from 'vite-node/source-map'
import type {
  EnvironmentOptions,
  ResolvedConfig,
  ResolvedTestEnvironment,
} from '../types'
import { getSafeTimers, getWorkerState } from '../utils'
import * as VitestIndex from '../index'
import { expect } from '../integrations/chai'
import { resolveSnapshotEnvironment } from '../integrations/snapshot/environments/resolveSnapshotEnvironment'
import { setupCommonEnv } from './setup-common'
import type { VitestExecutor } from './execute'

// this should only be used in Node
let globalSetup = false
export async function setupGlobalEnv(
  config: ResolvedConfig,
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
    _require.extensions['.css'] = () => ({})
    _require.extensions['.scss'] = () => ({})
    _require.extensions['.sass'] = () => ({})
    _require.extensions['.less'] = () => ({})
    process.env.SSR = ''
  }
  else {
    process.env.SSR = '1'
  }

  // @ts-expect-error not typed global for patched timers
  globalThis.__vitest_required__ = {
    util,
    timers,
  }

  installSourcemapsSupport({
    getSourceMap: source => state.moduleCache.getSourceMap(source),
  })

  if (!config.disableConsoleIntercept) {
    await setupConsoleLogSpy()
  }
}

export async function setupConsoleLogSpy() {
  const { createCustomConsole } = await import('./console')

  globalThis.console = createCustomConsole()
}

export async function withEnv(
  { environment }: ResolvedTestEnvironment,
  options: EnvironmentOptions,
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
