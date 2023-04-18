import { createRequire } from 'node:module'
import { isatty } from 'node:tty'
import { installSourcemapsSupport } from 'vite-node/source-map'
import { createColors, setupColors } from '@vitest/utils'
import type { EnvironmentOptions, ResolvedConfig, ResolvedTestEnvironment } from '../types'
import { VitestSnapshotEnvironment } from '../integrations/snapshot/environments/node'
import { getSafeTimers, getWorkerState } from '../utils'
import * as VitestIndex from '../index'
import { expect } from '../integrations/chai'
import { setupCommonEnv } from './setup.common'

// this should only be used in Node
let globalSetup = false
export async function setupGlobalEnv(config: ResolvedConfig) {
  await setupCommonEnv(config)

  Object.defineProperty(globalThis, '__vitest_index__', {
    value: VitestIndex,
    enumerable: false,
  })

  const state = getWorkerState()

  if (!state.config.snapshotOptions.snapshotEnvironment)
    state.config.snapshotOptions.snapshotEnvironment = new VitestSnapshotEnvironment(state.rpc)

  if (globalSetup)
    return

  globalSetup = true
  setupColors(createColors(isatty(1)))

  const _require = createRequire(import.meta.url)
  // always mock "required" `css` files, because we cannot process them
  _require.extensions['.css'] = () => ({})
  _require.extensions['.scss'] = () => ({})
  _require.extensions['.sass'] = () => ({})
  _require.extensions['.less'] = () => ({})

  installSourcemapsSupport({
    getSourceMap: source => state.moduleCache.getSourceMap(source),
  })

  await setupConsoleLogSpy()
}

export async function setupConsoleLogSpy() {
  const { createCustomConsole } = await import('./console')

  globalThis.console = createCustomConsole()
}

export async function withEnv(
  { environment, name }: ResolvedTestEnvironment,
  options: EnvironmentOptions,
  fn: () => Promise<void>,
) {
  // @ts-expect-error untyped global
  globalThis.__vitest_environment__ = name
  expect.setState({
    environment: name,
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
