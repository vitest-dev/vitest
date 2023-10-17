import type { CancelReason } from '@vitest/runner'
import type { VitestExecutor } from 'vitest/src/runtime/execute'
import { setupDialogsSpy } from './dialog'
import { setupConsoleLogSpy } from './logger'
import { assignVitestGlobals, browserHashMap, client, executor, importId, instantiateRunner, loadConfig } from './utils'
import { BrowserSnapshotEnvironment } from './snapshot'

let setCancel = (_: CancelReason) => {}
const onCancel = new Promise<CancelReason>((resolve) => {
  setCancel = resolve
})

function on(event: string, listener: (...args: any[]) => void) {
  window.addEventListener(event, listener)
  return () => window.removeEventListener(event, listener)
}

async function runTest(filename: string, version: string) {
  const config = await loadConfig()
  await assignVitestGlobals()
  await setupConsoleLogSpy()
  setupDialogsSpy()

  // @ts-expect-error untyped global
  const safeRpc = globalThis.__vitest_worker__.safeRpc

  // we can't import "processError" yet because error might've been thrown before the module was loaded
  async function defaultErrorReport(type: string, unhandledError: any) {
    const error = {
      ...unhandledError,
      name: unhandledError.name,
      message: unhandledError.message,
      stack: unhandledError.stack,
    }
    await client.rpc.onUnhandledError(error, type)
    await client.rpc.onDone(filename)
  }

  async function reportUnexpectedError(rpc: typeof client.rpc, type: string, error: any) {
    const { processError } = await importId('vitest/browser') as typeof import('vitest/browser')
    await rpc.onUnhandledError(processError(error), type)
    // if (!runningTests)
    await rpc.onDone(filename)
  }

  const stopErrorHandler = on('error', e => defaultErrorReport('Error', e.error))
  const stopRejectionHandler = on('unhandledrejection', e => defaultErrorReport('Unhandled Rejection', e.reason))

  stopErrorHandler()
  stopRejectionHandler()

  on('error', event => reportUnexpectedError(safeRpc, 'Error', event.error))
  on('unhandledrejection', event => reportUnexpectedError(safeRpc, 'Unhandled Rejection', event.reason))

  const currentVersion = browserHashMap.get(filename)
  if (!currentVersion || currentVersion[1] !== version)
    browserHashMap.set(filename, [true, version])

  const { runner, channel } = await instantiateRunner()

  onCancel.then((reason) => {
    runner?.onCancel?.(reason)
  })

  function removeBrowserChannel(event: BroadcastChannelEventMap['message']) {
    if (event.data.type === 'disconnect' && filename === event.data.filename) {
      channel.removeEventListener('message', removeBrowserChannel)
      channel.close()
    }
  }
  channel.removeEventListener('message', removeBrowserChannel)
  channel.addEventListener('message', removeBrowserChannel)

  const {
    startTests,
    loadDiffConfig,
    setupCommonEnv,
  } = await importId('vitest/browser') as typeof import('vitest/browser')

  if (!config.snapshotOptions.snapshotEnvironment)
    config.snapshotOptions.snapshotEnvironment = new BrowserSnapshotEnvironment()

  try {
    runner.config.diffOptions = await loadDiffConfig(config, executor as VitestExecutor)

    await setupCommonEnv(config)

    await startTests([filename], runner)
  }
  finally {
    // notify browser ui that the test is done
    channel.postMessage({ type: 'done', filename })
  }
}

// @ts-expect-error untyped global
globalThis.__vitest_browser_runner__ = { runTest }
