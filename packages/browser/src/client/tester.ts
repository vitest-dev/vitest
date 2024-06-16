import type { WorkerGlobalState } from 'vitest'
import { channel, client, onCancel } from './client'
import { setupDialogsSpy } from './dialog'
import { setupConsoleLogSpy } from './logger'
import { browserHashMap, initiateRunner } from './runner'
import { getBrowserState, getConfig, importId } from './utils'
import { loadSafeRpc } from './rpc'
import { VitestBrowserClientMocker } from './mocker'
import {
  registerUnexpectedErrors,
  registerUnhandledErrors,
  serializeError,
} from './unhandled'

const stopErrorHandler = registerUnhandledErrors()

const url = new URL(location.href)
const reloadStart = url.searchParams.get('__reloadStart')

function debug(...args: unknown[]) {
  const debug = getConfig().env.VITEST_BROWSER_DEBUG
  if (debug && debug !== 'false') {
    client.rpc.debug(...args.map(String))
  }
}

async function tryCall<T>(
  fn: () => Promise<T>,
): Promise<T | false | undefined> {
  try {
    return await fn()
  }
  catch (err: any) {
    const now = Date.now()
    // try for 30 seconds
    const canTry = !reloadStart || now - Number(reloadStart) < 30_000
    const errorStack = (() => {
      if (!err) {
        return null
      }
      return err.stack?.includes(err.message)
        ? err.stack
        : `${err.message}\n${err.stack}`
    })()
    debug(
      'failed to resolve runner',
      'trying again:',
      canTry,
      'time is',
      now,
      'reloadStart is',
      reloadStart,
      ':\n',
      errorStack,
    )
    if (!canTry) {
      const error = serializeError(
        new Error('Vitest failed to load its runner after 30 seconds.'),
      )
      error.cause = serializeError(err)

      await client.rpc.onUnhandledError(error, 'Preload Error')
      return false
    }

    if (!reloadStart) {
      const newUrl = new URL(location.href)
      newUrl.searchParams.set('__reloadStart', now.toString())
      debug('set the new url because reload start is not set to', newUrl)
      location.href = newUrl.toString()
    }
    else {
      debug('reload the iframe because reload start is set', location.href)
      location.reload()
    }
  }
}

const startTime = performance.now()

async function prepareTestEnvironment(files: string[]) {
  debug('trying to resolve runner', `${reloadStart}`)
  const config = getConfig()

  const viteClientPath = `/@vite/client`
  await import(viteClientPath)

  const rpc: any = await loadSafeRpc(client)

  const providedContext = await client.rpc.getProvidedContext()

  const state: WorkerGlobalState = {
    ctx: {
      pool: 'browser',
      worker: './browser.js',
      workerId: 1,
      config,
      projectName: config.name || '',
      files,
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
    moduleCache: getBrowserState().moduleCache,
    rpc,
    durations: {
      environment: 0,
      prepare: startTime,
    },
    providedContext,
  }
  // @ts-expect-error untyped global for internal use
  globalThis.__vitest_browser__ = true
  // @ts-expect-error mocking vitest apis
  globalThis.__vitest_worker__ = state
  const mocker = new VitestBrowserClientMocker()
  // @ts-expect-error mocking vitest apis
  globalThis.__vitest_mocker__ = mocker

  await setupConsoleLogSpy()
  setupDialogsSpy()

  const version = url.searchParams.get('browserv') || ''
  files.forEach((filename) => {
    const currentVersion = browserHashMap.get(filename)
    if (!currentVersion || currentVersion[1] !== version) {
      browserHashMap.set(filename, [true, version])
    }
  })

  const [runner, { startTests, setupCommonEnv, SpyModule }] = await Promise.all(
    [
      initiateRunner(state, mocker, config),
      importId('vitest/browser') as Promise<typeof import('vitest/browser')>,
    ],
  )

  mocker.setSpyModule(SpyModule)
  mocker.setupWorker()

  onCancel.then((reason) => {
    runner.onCancel?.(reason)
  })

  stopErrorHandler()
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
    preparedData = await tryCall(() => prepareTestEnvironment(files))
  }
  catch (error) {
    debug('data cannot be loaded because it threw an error')
    await client.rpc.onUnhandledError(serializeError(error), 'Preload Error')
    done(files)
    return
  }

  // cannot load data, finish the test
  if (preparedData === false) {
    debug('data cannot be loaded, finishing the test')
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
