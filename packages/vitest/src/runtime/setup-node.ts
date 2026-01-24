import type { Environment } from '../types/environment'
import type { SerializedConfig } from './config'
import { createRequire } from 'node:module'
import timers from 'node:timers'
import timersPromises from 'node:timers/promises'
import util from 'node:util'
import { KNOWN_ASSET_TYPES } from '@vitest/utils/constants'
import * as VitestIndex from '../public/index'
import { setupCommonEnv } from './setup-common'

// this should only be used in Node
let globalSetup = false
export async function setupGlobalEnv(
  config: SerializedConfig,
  environment: Environment,
): Promise<void> {
  await setupCommonEnv(config)

  Object.defineProperty(globalThis, '__vitest_index__', {
    value: VitestIndex,
    enumerable: false,
  })

  VitestIndex.expect.setState({
    environment: environment.name,
  })

  if (globalSetup) {
    return
  }

  globalSetup = true

  const viteEnvironment = environment.viteEnvironment || environment.name
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

export async function setupConsoleLogSpy(): Promise<void> {
  const { createCustomConsole } = await import('./console')

  globalThis.console = createCustomConsole()
}
