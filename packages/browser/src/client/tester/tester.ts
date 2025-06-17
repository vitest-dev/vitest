import type { BrowserRPC, IframeChannelEvent } from '@vitest/browser/client'
import { channel, client, onCancel } from '@vitest/browser/client'
import { page, server, userEvent } from '@vitest/browser/context'
import { parse } from 'flatted'
import {
  collectTests,
  setupCommonEnv,
  SpyModule,
  startCoverageInsideWorker,
  startTests,
  stopCoverageInsideWorker,
} from 'vitest/internal/browser'
import { executor, getBrowserState, getConfig, getWorkerState } from '../utils'
import { setupDialogsSpy } from './dialog'
import { setupConsoleLogSpy } from './logger'
import { VitestBrowserClientMocker } from './mocker'
import { createModuleMockerInterceptor } from './mocker-interceptor'
import { createSafeRpc } from './rpc'
import { browserHashMap, initiateRunner } from './runner'
import { CommandsManager } from './utils'

const debugVar = getConfig().env.VITEST_BROWSER_DEBUG
const debug = debugVar && debugVar !== 'false'
  ? (...args: unknown[]) => client.rpc.debug?.(...args.map(String))
  : undefined

channel.addEventListener('message', async (e) => {
  await client.waitForConnection()

  const data = e.data
  debug?.('event from orchestrator', JSON.stringify(e.data))

  if (!isEvent(data)) {
    const error = new Error(`Unknown message: ${JSON.stringify(e.data)}`)
    unhandledError(error, 'Uknown Iframe Message')
    return
  }

  // ignore events to other iframes
  if (!('iframeId' in data) || data.iframeId !== getBrowserState().iframeId) {
    return
  }

  switch (data.event) {
    case 'execute': {
      const { method, files, context } = data
      const state = getWorkerState()
      const parsedContext = parse(context)

      state.ctx.providedContext = parsedContext
      state.providedContext = parsedContext

      if (method === 'collect') {
        await executeTests('collect', files).catch(err => unhandledError(err, 'Collect Error'))
      }
      else {
        await executeTests('run', files).catch(err => unhandledError(err, 'Run Error'))
      }
      break
    }
    case 'cleanup': {
      await cleanup().catch(err => unhandledError(err, 'Cleanup Error'))
      break
    }
    case 'prepare': {
      await prepare(data).catch(err => unhandledError(err, 'Prepare Error'))
      break
    }
    case 'viewport:done':
    case 'viewport:fail':
    case 'viewport': {
      break
    }
    default: {
      const error = new Error(`Unknown event: ${(data as any).event}`)
      unhandledError(error, 'Uknown Event')
    }
  }

  channel.postMessage({
    event: `response:${data.event}`,
    iframeId: getBrowserState().iframeId!,
  })
})

const url = new URL(location.href)
const reloadStart = url.searchParams.get('__reloadStart')
const iframeId = url.searchParams.get('iframeId')!

const commands = new CommandsManager()
getBrowserState().commands = commands
getBrowserState().iframeId = iframeId

let contextSwitched = false

async function prepareTestEnvironment(options: PrepareOptions) {
  debug?.('trying to resolve runner', `${reloadStart}`)
  const config = getConfig()

  const rpc = createSafeRpc(client)

  const state = getWorkerState()

  state.onCancel = onCancel
  state.rpc = rpc as any

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

  const runner = await initiateRunner(state, mocker, config)
  getBrowserState().runner = runner

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
        switchPromise = rpc.wdioSwitchContext('iframe').finally(() => {
          switchPromise = null
          contextSwitched = true
        })
        await switchPromise
      }
    })
  }

  state.durations.prepare = performance.now() - options.startTime

  return {
    runner,
    config,
    state,
  }
}

let preparedData:
  | Awaited<ReturnType<typeof prepareTestEnvironment>>
  | undefined

async function executeTests(method: 'run' | 'collect', files: string[]) {
  if (!preparedData) {
    throw new Error(`Data was not properly initialized. This is a bug in Vitest. Please, open a new issue with reproduction.`)
  }

  debug?.('runner resolved successfully')

  const { runner, state } = preparedData

  state.ctx.files = files
  runner.setMethod(method)

  const version = url.searchParams.get('browserv') || ''
  files.forEach((filename) => {
    const currentVersion = browserHashMap.get(filename)
    if (!currentVersion || currentVersion[1] !== version) {
      browserHashMap.set(filename, version)
    }
  })

  debug?.('prepare time', state.durations.prepare, 'ms')

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

interface PrepareOptions {
  startTime: number
}

async function prepare(options: PrepareOptions) {
  preparedData = await prepareTestEnvironment(options)

  // page is reloading
  debug?.('runner resolved successfully')

  const { config, state } = preparedData

  state.durations.prepare = performance.now() - state.durations.prepare

  debug?.('prepare time', state.durations.prepare, 'ms')

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
}

async function cleanup() {
  const state = getWorkerState()
  const config = getConfig()
  const rpc = state.rpc as any as BrowserRPC

  const cleanupSymbol = Symbol.for('vitest:component-cleanup')

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

  await Promise.all(
    getBrowserState().cleanups.map(fn => fn()),
  ).catch(error => unhandledError(error, 'Cleanup Error'))

  // if isolation is disabled, Vitest reuses the same iframe and we
  // don't need to switch the context back at all
  if (contextSwitched) {
    await rpc.wdioSwitchContext('parent')
      .catch(error => unhandledError(error, 'Cleanup Error'))
  }
  state.environmentTeardownRun = true
  await stopCoverageInsideWorker(config.coverage, executor, { isolate: config.browser.isolate }).catch((error) => {
    return unhandledError(error, 'Coverage Error')
  })
}

function unhandledError(e: Error, type: string) {
  return client.rpc.onUnhandledError({
    name: e.name,
    message: e.message,
    stack: e.stack,
  }, type).catch(() => {})
}
function isEvent(data: unknown): data is IframeChannelEvent {
  return typeof data === 'object' && !!data && 'event' in data
}
