import type { BrowserRPC } from '@vitest/browser/client'
import type { IframeInitEvent } from '../types'
import { channel, client, onCancel } from '@vitest/browser/client'
import { page, server, userEvent } from '@vitest/browser/context'
import { parse } from 'flatted'
import { collectTests, setupCommonEnv, SpyModule, startCoverageInsideWorker, startTests, stopCoverageInsideWorker } from 'vitest/browser'
import { executor, getBrowserState, getConfig, getWorkerState } from '../utils'
import { setupDialogsSpy } from './dialog'
import { setupExpectDom } from './expect-element'
import { setupConsoleLogSpy } from './logger'
import { VitestBrowserClientMocker } from './mocker'
import { createModuleMockerInterceptor } from './msw'
import { createSafeRpc } from './rpc'
import { browserHashMap, initiateRunner } from './runner'
import { CommandsManager } from './utils'

const cleanupSymbol = Symbol.for('vitest:component-cleanup')

const url = new URL(location.href)
const reloadStart = url.searchParams.get('__reloadStart')

const commands = new CommandsManager()
getBrowserState().commands = commands

let contextSwitched = false

// webdiverio context depends on the iframe state, so we need to switch the context,
// we delay this in case the user doesn't use any userEvent commands to avoid the overhead
if (server.provider === 'webdriverio') {
  let switchPromise: Promise<void> | null = null

  commands.onCommand(async () => {
    if (switchPromise) {
      await switchPromise
    }
    // if this is the first command, make sure we switched the command context to an iframe
    if (!contextSwitched) {
      const rpc = getWorkerState().rpc as any as BrowserRPC
      switchPromise = rpc.wdioSwitchContext('iframe').finally(() => {
        switchPromise = null
        contextSwitched = true
      })
      await switchPromise
    }
  })
}

async function prepareTestEnvironment(files: string[]) {
  debug('trying to resolve runner', `${reloadStart}`)
  const config = getConfig()

  const rpc = createSafeRpc(client)

  const state = getWorkerState()

  state.ctx.files = files
  state.onCancel = onCancel
  state.rpc = rpc as any

  // TODO: expose `worker`
  const interceptor = createModuleMockerInterceptor()
  const mocker = new VitestBrowserClientMocker(
    interceptor,
    rpc,
    SpyModule.spyOn,
    {
      root: getBrowserState().viteConfig.root,
    },
  )
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
      browserHashMap.set(filename, version)
    }
  })

  return {
    runner,
    config,
    state,
    rpc,
  }
}

function done(files: string[]) {
  channel.postMessage({
    type: 'done',
    filenames: files,
    id: getBrowserState().iframeId!,
  })
}

async function executeTests(method: 'run' | 'collect', files: string[]) {
  await client.waitForConnection()

  debug('client is connected to ws server')

  let preparedData:
    | Awaited<ReturnType<typeof prepareTestEnvironment>>
    | undefined
    | false

  try {
    preparedData = await prepareTestEnvironment(files)
  }
  catch (error: any) {
    debug('runner cannot be loaded because it threw an error', error.stack || error.message)
    await client.rpc.onUnhandledError({
      name: error.name,
      message: error.message,
      stack: String(error.stack),
    }, 'Preload Error')
    done(files)
    return
  }

  // page is reloading
  if (!preparedData) {
    debug('page is reloading, waiting for the next run')
    return
  }

  debug('runner resolved successfully')

  const { config, runner, state, rpc } = preparedData

  state.durations.prepare = performance.now() - state.durations.prepare

  debug('prepare time', state.durations.prepare, 'ms')

  try {
    await Promise.all([
      setupCommonEnv(config),
      startCoverageInsideWorker(config.coverage, executor, { isolate: config.browser.isolate }),
      (async () => {
        const VitestIndex = await import('vitest')
        Object.defineProperty(window, '__vitest_index__', {
          value: VitestIndex,
          enumerable: false,
        })
      })(),
    ])

    for (const file of files) {
      state.filepath = file

      if (method === 'run') {
        await startTests([file], runner)
      }
      else {
        await collectTests([file], runner)
      }
    }
  }
  finally {
    if (cleanupSymbol in page) {
      try {
        await (page[cleanupSymbol] as any)()
      }
      catch (error: any) {
        await unhandledError(error, 'Cleanup Error')
      }
    }
    // need to cleanup for each tester
    // since playwright keyboard API is stateful on page instance level
    await userEvent.cleanup()
      .catch(error => unhandledError(error, 'Cleanup Error'))

    // if isolation is disabled, Vitest reuses the same iframe and we
    // don't need to switch the context back at all
    if (server.config.browser.isolate !== false && contextSwitched) {
      await rpc.wdioSwitchContext('parent')
        .catch(error => unhandledError(error, 'Cleanup Error'))
    }
    state.environmentTeardownRun = true
    await stopCoverageInsideWorker(config.coverage, executor, { isolate: config.browser.isolate }).catch((error) => {
      return unhandledError(error, 'Coverage Error')
    })

    debug('finished running tests')
    done(files)
  }
}

// listen when orchestrator sends a message
window.addEventListener('message', (e) => {
  const data = JSON.parse(e.data)
  debug('event from orchestrator', e.data)

  if (typeof data === 'object' && data?.event === 'init') {
    const { method, files, context, iframeId } = data as IframeInitEvent
    const state = getWorkerState()
    const parsedContext = parse(context)

    state.ctx.providedContext = parsedContext
    state.providedContext = parsedContext
    getBrowserState().iframeId = iframeId

    if (method === 'collect') {
      executeTests('collect', files).catch(err => unhandledError(err, 'Collect Error'))
    }
    else {
      executeTests('run', files).catch(err => unhandledError(err, 'Run Error'))
    }
  }
  else {
    const error = new Error(`Unknown event: ${data.event}`)
    unhandledError(error, 'Uknown Event')
  }
})

function unhandledError(e: Error, type: string) {
  return client.rpc.onUnhandledError({
    name: e.name,
    message: e.message,
    stack: e.stack,
  }, type).catch(() => {})
}

function debug(...args: unknown[]) {
  const debug = getConfig().env.VITEST_BROWSER_DEBUG
  if (debug && debug !== 'false') {
    client.rpc.debug(...args.map(String))
  }
}
