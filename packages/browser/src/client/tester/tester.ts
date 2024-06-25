import { SpyModule, setupCommonEnv, startTests } from 'vitest/browser'
import { getBrowserState, getConfig, getWorkerState } from '../utils'
import { channel, client, onCancel } from '../client'
import { setupDialogsSpy } from './dialog'
import {
  registerUnexpectedErrors,
  serializeError,
} from './unhandled'
import { setupConsoleLogSpy } from './logger'
import { createSafeRpc } from './rpc'
import { browserHashMap, initiateRunner } from './runner'
import { VitestBrowserClientMocker } from './mocker'
import { setupExpectDom } from './expect-dom'

const url = new URL(location.href)
const reloadStart = url.searchParams.get('__reloadStart')

function debug(...args: unknown[]) {
  const debug = getConfig().env.VITEST_BROWSER_DEBUG
  if (debug && debug !== 'false') {
    client.rpc.debug(...args.map(String))
  }
}

async function prepareTestEnvironment(files: string[]) {
  debug('trying to resolve runner', `${reloadStart}`)
  const config = getConfig()

  const rpc = createSafeRpc(client)

  const state = getWorkerState()

  state.ctx.files = files
  state.onCancel = onCancel
  state.rpc = rpc as any

  const mocker = new VitestBrowserClientMocker()
  // @ts-expect-error mocking vitest apis
  globalThis.__vitest_mocker__ = mocker

  setupConsoleLogSpy()
  setupDialogsSpy()
  setupExpectDom()

  const runner = await initiateRunner(state, mocker, config)

  const version = url.searchParams.get('browserv') || ''
  files.forEach((filename) => {
    const currentVersion = browserHashMap.get(filename)
    if (!currentVersion || currentVersion[1] !== version) {
      browserHashMap.set(filename, [true, version])
    }
  })

  mocker.setSpyModule(SpyModule)
  mocker.setupWorker()

  onCancel.then((reason) => {
    runner.onCancel?.(reason)
  })

  registerUnexpectedErrors(rpc)

  return {
    runner,
    config,
    state,
    setupCommonEnv,
    startTests,
  }
}

function done(files: string[]) {
  channel.postMessage({
    type: 'done',
    filenames: files,
    id: getBrowserState().iframeId!,
  })
}

async function runTests(files: string[]) {
  await client.waitForConnection()

  debug('client is connected to ws server')

  let preparedData:
    | Awaited<ReturnType<typeof prepareTestEnvironment>>
    | undefined
    | false

  // if importing /@id/ failed, we reload the page waiting until Vite prebundles it
  try {
    preparedData = await prepareTestEnvironment(files)
  }
  catch (error) {
    debug('data cannot be loaded because it threw an error')
    await client.rpc.onUnhandledError(serializeError(error), 'Preload Error')
    done(files)
    return
  }

  // page is reloading
  if (!preparedData) {
    debug('page is reloading, waiting for the next run')
    return
  }

  debug('runner resolved successfully')

  const { config, runner, state, setupCommonEnv, startTests } = preparedData

  state.durations.prepare = performance.now() - state.durations.prepare

  debug('prepare time', state.durations.prepare, 'ms')

  try {
    await setupCommonEnv(config)
    for (const file of files) {
      await startTests([file], runner)
    }
  }
  finally {
    state.environmentTeardownRun = true
    debug('finished running tests')
    done(files)
  }
}

// @ts-expect-error untyped global for internal use
window.__vitest_browser_runner__.runTests = runTests
