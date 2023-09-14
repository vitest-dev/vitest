import { createRequire } from 'node:module'
import { isatty } from 'node:tty'
import { installSourcemapsSupport } from 'vite-node/source-map'
import { createColors, setupColors } from '@vitest/utils'
import type { ResolvedConfig, ResolvedTestEnvironment, WorkerGlobalState } from '../types'
import { VitestSnapshotEnvironment } from '../integrations/snapshot/environments/node'
import { getWorkerState } from '../utils'
import * as VitestIndex from '../index'
import { setupCommonEnv } from './setup.common'

// this should only be used in Node
let globalSetup = false
export async function setupGlobalEnv(config: ResolvedConfig, { environment }: ResolvedTestEnvironment) {
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

  installSourcemapsSupport({
    getSourceMap: source => state.moduleCache.getSourceMap(source),
  })

  if (!process.versions.bun)
    await setupConsoleLogSpy(state)
}

export async function setupConsoleLogSpy(state: WorkerGlobalState) {
  const { createCustomConsole } = await import('./console')

  globalThis.console = await createCustomConsole(state)
}
