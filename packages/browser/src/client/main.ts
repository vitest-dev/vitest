import { createClient } from '@vitest/ws-client'
// eslint-disable-next-line no-restricted-imports
import type { ResolvedConfig } from 'vitest'
import type { VitestRunner } from '@vitest/runner'
import { createBrowserRunner } from './runner'
import { importId } from './utils'
import { setupConsoleLogSpy } from './logger'
import { createSafeRpc, rpc, rpcDone } from './rpc'
import { setupDialogsSpy } from './dialog'
import { BrowserSnapshotEnvironment } from './snapshot'

// @ts-expect-error mocking some node apis
globalThis.process = { env: {}, argv: [], cwd: () => '/', stdout: { write: () => {} }, nextTick: cb => cb() }
globalThis.global = globalThis

export const PORT = import.meta.hot ? '51204' : location.port
export const HOST = [location.hostname, PORT].filter(Boolean).join(':')
export const ENTRY_URL = `${
  location.protocol === 'https:' ? 'wss:' : 'ws:'
}//${HOST}/__vitest_api__`

let config: ResolvedConfig | undefined
let runner: VitestRunner | undefined
let vitestBC: BroadcastChannel | undefined
let currentModule: string | undefined
const browserHashMap = new Map<string, [test: boolean, timestamp: string]>()
const browserIFrames = new Map<string, HTMLIFrameElement>()

const url = new URL(location.href)
const testId = url.searchParams.get('id') || 'unknown'

function getQueryPaths() {
  return url.searchParams.getAll('path')
}

export const client = createClient(ENTRY_URL)

const ws = client.ws

async function loadConfig() {
  let retries = 5
  do {
    try {
      await new Promise(resolve => setTimeout(resolve, 150))
      config = await client.rpc.getConfig()
      return
    }
    catch (_) {
      // just ignore
    }
  }
  while (--retries > 0)

  throw new Error('cannot load configuration after 5 retries')
}

ws.addEventListener('open', async () => {
  await loadConfig()

  const { getSafeTimers } = await importId('vitest/utils') as typeof import('vitest/utils')
  const safeRpc = createSafeRpc(client, getSafeTimers)

  // @ts-expect-error untyped global for internal use
  globalThis.__vitest_browser__ = true
  // @ts-expect-error mocking vitest apis
  globalThis.__vitest_worker__ = {
    config,
    browserHashMap,
    moduleCache: new Map(),
    rpc: client.rpc,
    safeRpc,
    durations: {
      environment: 0,
      prepare: 0,
    },
  }

  const paths = getQueryPaths()

  const iFrame = document.getElementById('vitest-ui') as HTMLIFrameElement
  iFrame.setAttribute('src', '/__vitest__/')
  const button = document.getElementById('vitest-browser-button') as HTMLButtonElement
  button.addEventListener('click', () => {
    if (currentModule && browserHashMap.has(currentModule)) {
      const hidden = iFrame.classList.contains('hidden')
      button.innerText = hidden ? 'Show Test UI' : 'Hide Test UI'
      iFrame.classList.toggle('hidden')
      const targetIFrame = browserIFrames.get(currentModule)
      targetIFrame?.classList.remove('show')
      if (!hidden)
        targetIFrame?.classList.add('show')
    }
  })

  window.addEventListener('storage', (e) => {
    if (e.key === 'vueuse-color-scheme')
      document.documentElement.classList.toggle('dark', e.newValue === 'dark')
  })

  await setupConsoleLogSpy()
  setupDialogsSpy()
  await runTests(paths, config!, (e) => {
    if (e.data.type === 'navigate') {
      currentModule = e.data.filename
      button.removeAttribute('disabled')
      if (!currentModule)
        button.setAttribute('disabled', 'true')
    }
  })
})

async function runTests(
  paths: string[],
  config: ResolvedConfig,
  navigate: (ev: BroadcastChannelEventMap['message']) => void,
) {
  // need to import it before any other import, otherwise Vite optimizer will hang
  const viteClientPath = '/@vite/client'
  await import(viteClientPath)

  const {
    startTests,
    setupCommonEnv,
    takeCoverageInsideWorker,
  } = await importId('vitest/browser') as typeof import('vitest/browser')

  const executor = {
    executeId: (id: string) => importId(id),
  }

  if (!runner) {
    vitestBC = new BroadcastChannel('vitest-browser')
    vitestBC.addEventListener('message', navigate)
    const { VitestTestRunner } = await importId('vitest/runners') as typeof import('vitest/runners')
    const BrowserRunner = createBrowserRunner(VitestTestRunner, { takeCoverage: () => takeCoverageInsideWorker(config.coverage, executor) })
    runner = new BrowserRunner({ config, browserHashMap, vitestBC })
  }

  if (!config.snapshotOptions.snapshotEnvironment)
    config.snapshotOptions.snapshotEnvironment = new BrowserSnapshotEnvironment()

  try {
    await setupCommonEnv(config)
    const files = paths.map((path) => {
      return (`${config.root}/${path}`).replace(/\/+/g, '/')
    })

    const now = `${new Date().getTime()}`
    files.forEach((i) => {
      browserHashMap.set(i, [true, now])
      const iFrame = document.createElement('iframe')
      // by default hidden
      iFrame.setAttribute('loading', 'eager')
      iFrame.classList.add('iframe-test')
      iFrame.setAttribute('src', `${url.pathname}/__vitest_test__/${i}.html`.replace('//', '/'))
      browserIFrames.set(i, iFrame)
      document.body.appendChild(iFrame)
    })

    await new Promise(resolve => setTimeout(resolve, 1000))

    for (const file of files)
      await startTests([file], runner)
  }
  finally {
    await rpcDone()
    await rpc().onDone(testId)
  }
}
