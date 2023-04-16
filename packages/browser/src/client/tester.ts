import { setupDialogsSpy } from "./dialog"
import { setupConsoleLogSpy } from "./logger"
import { assignVitestGlobals, importId, loadConfig, instantiateRunner } from "./utils"
import { BrowserSnapshotEnvironment } from "./snapshot"

// @ts-expect-error mocking some node apis
globalThis.process = { env: {}, argv: [], cwd: () => '/', stdout: { write: () => {} }, nextTick: cb => cb() }
globalThis.global = globalThis
async function runTest(file: string) {
  const config = await loadConfig()
  await assignVitestGlobals()
  await setupConsoleLogSpy()
  setupDialogsSpy()

  const {runner, channel} = await instantiateRunner()

  const {
    startTests,
    setupCommonEnv,
  } = await importId('vitest/browser') as typeof import('vitest/browser')

  if (!config.snapshotOptions.snapshotEnvironment)
    config.snapshotOptions.snapshotEnvironment = new BrowserSnapshotEnvironment()

  try {
    await setupCommonEnv(config)

    await startTests([file], runner)
  } finally {
    channel.postMessage({ type: 'done', filename: file })
  }
}

// todo: add logic to run the test, maybe we need broadcastchannel to await execution from main.ts

globalThis.runTest = runTest
