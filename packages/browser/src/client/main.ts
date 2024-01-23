import { channel, client } from './client'

const url = new URL(location.href)
const testId = url.searchParams.get('__vitest_id')!
const testLength = Number(url.searchParams.get('__vitest_length') || 0)

const iframes = new Map<number, HTMLIFrameElement>()

client.ws.addEventListener('open', async () => {
  const container = document.querySelector('#vitest-tester') as HTMLDivElement
  const now = `${new Date().getTime()}`

  const done = new Set<string>()
  channel.addEventListener('message', async (e) => {
    if (e.data.type === 'done') {
      const filename = e.data.filename
      if (!filename)
        return
      done.add(filename)

      if (done.size === testLength)
        await client.rpc.onDone(testId)
    }
  })

  for (let index = 0; index < testLength; index++) {
    if (iframes.has(index)) {
      container.removeChild(iframes.get(index)!)
      iframes.delete(index)
    }

    const iframe = document.createElement('iframe')
    iframe.setAttribute('loading', 'eager')
    iframe.setAttribute('src', `${url.pathname}__vitest_test__/tester.html?__vitest_index=${index}&__vitest_id=${testId}&browserv=${now}`)
    iframes.set(index, iframe)
    container.appendChild(iframe)
  }
})

// export const PORT = import.meta.hot ? '51204' : location.port
// export const HOST = [location.hostname, PORT].filter(Boolean).join(':')
// export const ENTRY_URL = `${
//   location.protocol === 'https:' ? 'wss:' : 'ws:'
// }//${HOST}/__vitest_api__`

// let config: ResolvedConfig | undefined
// let runner: VitestRunner | undefined
// const browserHashMap = new Map<string, [test: boolean, timestamp: string]>()

//
// const testId = url.searchParams.get('id') || 'unknown'
// const reloadTries = Number(url.searchParams.get('reloadTries') || '0')

// const basePath = () => config?.base || '/'
// const importId = (id: string) => _importId(id, basePath())
// const viteClientPath = () => `${basePath()}@vite/client`

// function getQueryPaths() {
//   return url.searchParams.getAll('path')
// }

// let setCancel = (_: CancelReason) => {}
// const onCancel = new Promise<CancelReason>((resolve) => {
//   setCancel = resolve
// })

// export const client = createClient(ENTRY_URL, {
//   handlers: {
//     onCancel: setCancel,
//   },
// })

// const ws = client.ws

// async function loadConfig() {
//   let retries = 5
//   do {
//     try {
//       await new Promise(resolve => setTimeout(resolve, 150))
//       config = await client.rpc.getConfig()
//       config = unwrapConfig(config)
//       return
//     }
//     catch (_) {
//       // just ignore
//     }
//   }
//   while (--retries > 0)

//   throw new Error('cannot load configuration after 5 retries')
// }

// function unwrapConfig(config: ResolvedConfig): ResolvedConfig {
//   return {
//     ...config,
//     // workaround RegExp serialization
//     testNamePattern:
//       config.testNamePattern
//         ? parseRegexp((config.testNamePattern as any as string))
//         : undefined,
//   }
// }

// function on(event: string, listener: (...args: any[]) => void) {
//   window.addEventListener(event, listener)
//   return () => window.removeEventListener(event, listener)
// }

// function serializeError(unhandledError: any) {
//   return {
//     ...unhandledError,
//     name: unhandledError.name,
//     message: unhandledError.message,
//     stack: String(unhandledError.stack),
//   }
// }

// // we can't import "processError" yet because error might've been thrown before the module was loaded
// async function defaultErrorReport(type: string, unhandledError: any) {
//   const error = serializeError(unhandledError)
//   if (testId !== 'no-isolate')
//     error.VITEST_TEST_PATH = testId
//   await client.rpc.onUnhandledError(error, type)
//   await client.rpc.onDone(testId)
// }

// function catchWindowErrors(cb: (e: ErrorEvent) => void) {
//   let userErrorListenerCount = 0
//   function throwUnhandlerError(e: ErrorEvent) {
//     if (userErrorListenerCount === 0 && e.error != null)
//       cb(e)
//     else
//       console.error(e.error)
//   }
//   const addEventListener = window.addEventListener.bind(window)
//   const removeEventListener = window.removeEventListener.bind(window)
//   window.addEventListener('error', throwUnhandlerError)
//   window.addEventListener = function (...args: Parameters<typeof addEventListener>) {
//     if (args[0] === 'error')
//       userErrorListenerCount++
//     return addEventListener.apply(this, args)
//   }
//   window.removeEventListener = function (...args: Parameters<typeof removeEventListener>) {
//     if (args[0] === 'error' && userErrorListenerCount)
//       userErrorListenerCount--
//     return removeEventListener.apply(this, args)
//   }
//   return function clearErrorHandlers() {
//     window.removeEventListener('error', throwUnhandlerError)
//   }
// }

// const stopErrorHandler = catchWindowErrors(e => defaultErrorReport('Error', e.error))
// const stopRejectionHandler = on('unhandledrejection', e => defaultErrorReport('Unhandled Rejection', e.reason))

// let runningTests = false

// async function reportUnexpectedError(rpc: typeof client.rpc, type: string, error: any) {
//   const { processError } = await importId('vitest/browser') as typeof import('vitest/browser')
//   const processedError = processError(error)
//   if (testId !== 'no-isolate')
//     error.VITEST_TEST_PATH = testId
//   await rpc.onUnhandledError(processedError, type)
//   if (!runningTests)
//     await rpc.onDone(testId)
// }

// ws.addEventListener('open', async () => {
//   await loadConfig()

//   let safeRpc: typeof client.rpc
//   try {
//     // if importing /@id/ failed, we reload the page waiting until Vite prebundles it
//     const { getSafeTimers } = await importId('vitest/utils') as typeof import('vitest/utils')
//     safeRpc = createSafeRpc(client, getSafeTimers)
//   }
//   catch (err: any) {
//     if (reloadTries >= 10) {
//       const error = serializeError(new Error('Vitest failed to load "vitest/utils" after 10 retries.'))
//       error.cause = serializeError(err)

//       await client.rpc.onUnhandledError(error, 'Reload Error')
//       await client.rpc.onDone(testId)
//       return
//     }

//     const tries = reloadTries + 1
//     const newUrl = new URL(location.href)
//     newUrl.searchParams.set('reloadTries', String(tries))
//     location.href = newUrl.href
//     return
//   }

//   stopErrorHandler()
//   stopRejectionHandler()

// catchWindowErrors(event => reportUnexpectedError(safeRpc, 'Error', event.error))
// on('unhandledrejection', event => reportUnexpectedError(safeRpc, 'Unhandled Rejection', event.reason))

//   // @ts-expect-error untyped global for internal use
//   globalThis.__vitest_browser__ = true
//   // @ts-expect-error mocking vitest apis
//   globalThis.__vitest_worker__ = {
//     config,
//     browserHashMap,
//     environment: {
//       name: 'browser',
//     },
//     // @ts-expect-error untyped global for internal use
//     moduleCache: globalThis.__vi_module_cache__,
//     rpc: client.rpc,
//     safeRpc,
//     durations: {
//       environment: 0,
//       prepare: 0,
//     },
//     providedContext: await client.rpc.getProvidedContext(),
//   }
//   // @ts-expect-error mocking vitest apis
//   globalThis.__vitest_mocker__ = new VitestBrowserClientMocker()

//   const paths = getQueryPaths()

//   const iFrame = document.getElementById('vitest-ui') as HTMLIFrameElement
//   iFrame.setAttribute('src', '/__vitest__/')

//   await setupConsoleLogSpy(basePath())
//   setupDialogsSpy()
//   await runTests(paths, config!)
// })

// async function prepareTestEnvironment(config: ResolvedConfig) {
//   // need to import it before any other import, otherwise Vite optimizer will hang
//   await import(viteClientPath())

//   const {
//     startTests,
//     setupCommonEnv,
//     loadDiffConfig,
//     takeCoverageInsideWorker,
//   } = await importId('vitest/browser') as typeof import('vitest/browser')

//   const executor = {
//     executeId: (id: string) => importId(id),
//   }

//   if (!runner) {
//     const { VitestTestRunner } = await importId('vitest/runners') as typeof import('vitest/runners')
//     const BrowserRunner = createBrowserRunner(VitestTestRunner, { takeCoverage: () => takeCoverageInsideWorker(config.coverage, executor) })
//     runner = new BrowserRunner({ config, browserHashMap })
//   }

//   return {
//     startTests,
//     setupCommonEnv,
//     loadDiffConfig,
//     executor,
//     runner,
//   }
// }

// async function runTests(paths: string[], config: ResolvedConfig) {
//   let preparedData: Awaited<ReturnType<typeof prepareTestEnvironment>> | undefined
//   // if importing /@id/ failed, we reload the page waiting until Vite prebundles it
//   try {
//     preparedData = await prepareTestEnvironment(config)
//   }
//   catch (err) {
//     location.reload()
//     return
//   }

//   const { startTests, setupCommonEnv, loadDiffConfig, executor, runner } = preparedData!

//   onCancel.then((reason) => {
//     runner?.onCancel?.(reason)
//   })

//   if (!config.snapshotOptions.snapshotEnvironment)
//     config.snapshotOptions.snapshotEnvironment = new BrowserSnapshotEnvironment()

//   try {
//     runner.config.diffOptions = await loadDiffConfig(config, executor as VitestExecutor)

//     await setupCommonEnv(config)
//     const files = paths.map((path) => {
//       return (`${config.root}/${path}`).replace(/\/+/g, '/')
//     })

//     const now = `${new Date().getTime()}`
//     files.forEach(i => browserHashMap.set(i, [true, now]))

//     runningTests = true

//     for (const file of files)
//       await startTests([file], runner)
//   }
//   finally {
//     runningTests = false

//     await rpcDone()
//     await rpc().onDone(testId)
//   }
// }
