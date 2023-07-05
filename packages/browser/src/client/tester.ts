import { setupDialogsSpy } from './dialog'
import { setupConsoleLogSpy } from './logger'
import { assignVitestGlobals, browserHashMap, importId, instantiateRunner, loadConfig } from './utils'
import { BrowserSnapshotEnvironment } from './snapshot'

async function runTest(filename: string, version: string) {
  const config = await loadConfig()
  await assignVitestGlobals()
  await setupConsoleLogSpy()
  setupDialogsSpy()

  const currentVersion = browserHashMap.get(filename)
  if (!currentVersion || currentVersion[1] !== version)
    browserHashMap.set(filename, [true, version])

  const { runner, channel } = await instantiateRunner()

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
    setupCommonEnv,
  } = await importId('vitest/browser') as typeof import('vitest/browser')

  if (!config.snapshotOptions.snapshotEnvironment)
    config.snapshotOptions.snapshotEnvironment = new BrowserSnapshotEnvironment()

  try {
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
