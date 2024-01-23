import type { WorkerGlobalState } from 'vitest'
import { channel, client, onCancel } from './client'
import { setupDialogsSpy } from './dialog'
import { setupConsoleLogSpy } from './logger'
import { browserHashMap, initiateRunner } from './runner'
import { getConfig, importId } from './utils'
import { loadSafeRpc } from './rpc'
import { VitestBrowserClientMocker } from './mocker'
import { registerUnexpectedErrors, registerUnhandledErrors } from './unhandled'

const stopErrorHandler = registerUnhandledErrors()

const url = new URL(location.href)

async function runTest(filename: string) {
  await client.waitForConnection()

  const config = getConfig()

  const viteClientPath = `${config.base || '/'}@vite/client`
  await import(viteClientPath)

  let rpc: any
  try {
    rpc = await loadSafeRpc(client)
  }
  catch (error) {
    await client.rpc.onUnhandledError(error, 'Reload Error')
    channel.postMessage({ type: 'done', filename })
    return
  }

  if (!rpc) {
    channel.postMessage({ type: 'done', filename })
    return
  }

  stopErrorHandler()
  registerUnexpectedErrors(rpc)

  const providedContext = await client.rpc.getProvidedContext()

  const state: WorkerGlobalState = {
    ctx: {
      pool: 'browser',
      worker: './browser.js',
      workerId: 1,
      config,
      projectName: config.name,
      files: [filename],
      environment: {
        name: 'browser',
        options: null,
      },
      providedContext,
      invalidates: [],
    },
    onCancel,
    mockMap: new Map(),
    config,
    environment: {
      name: 'browser',
      transformMode: 'web',
      setup() {
        throw new Error('Not called in the browser')
      },
    },
    // @ts-expect-error untyped global for internal use
    moduleCache: globalThis.__vi_module_cache__,
    rpc,
    durations: {
      environment: 0,
      prepare: 0,
    },
    providedContext,
  }
  // @ts-expect-error untyped global for internal use
  globalThis.__vitest_browser__ = true
  // @ts-expect-error mocking vitest apis
  globalThis.__vitest_worker__ = state
  // @ts-expect-error mocking vitest apis
  globalThis.__vitest_mocker__ = new VitestBrowserClientMocker()

  await setupConsoleLogSpy()
  setupDialogsSpy()

  const { startTests, setupCommonEnv } = await importId('vitest/browser') as typeof import('vitest/browser')

  const version = url.searchParams.get('browserv') || '0'
  const currentVersion = browserHashMap.get(filename)
  if (!currentVersion || currentVersion[1] !== version)
    browserHashMap.set(filename, [true, version])

  const runner = await initiateRunner()

  function removeBrowserChannel(event: BroadcastChannelEventMap['message']) {
    if (event.data.type === 'disconnect' && filename === event.data.filename) {
      channel.removeEventListener('message', removeBrowserChannel)
      channel.close()
    }
  }
  channel.addEventListener('message', removeBrowserChannel)

  onCancel.then((reason) => {
    runner.onCancel?.(reason)
  })

  try {
    await setupCommonEnv(config)
    await startTests([filename], runner)
  }
  finally {
    channel.postMessage({ type: 'done', filename })
  }
}

// @ts-expect-error untyped global
globalThis.__vitest_browser_runner__ = { runTest }
