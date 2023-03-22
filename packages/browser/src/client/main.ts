import type { VitestClient } from '@vitest/ws-client'
import { createClient } from '@vitest/ws-client'
// eslint-disable-next-line no-restricted-imports
import type { ResolvedConfig } from 'vitest'
import type { VitestRunner } from '@vitest/runner'
import { createBrowserRunner } from './runner'
import { BrowserSnapshotEnvironment } from './snapshot'
import { importId } from './utils'
import { setupConsoleLogSpy } from './logger'
import { rpc, rpcDone } from './rpc'

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
const browserHashMap = new Map<string, string>()

const url = new URL(location.href)
const testId = url.searchParams.get('id') || 'unknown'

const getQueryPaths = () => {
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

  // @ts-expect-error mocking vitest apis
  globalThis.__vitest_worker__ = {
    config,
    browserHashMap,
    moduleCache: new Map(),
    rpc: client.rpc,
  }

  // @ts-expect-error mocking vitest apis
  globalThis.__vitest_mocker__ = {}
  const paths = getQueryPaths()

  const iFrame = document.getElementById('vitest-ui') as HTMLIFrameElement
  iFrame.setAttribute('src', '/__vitest__/')

  await setupConsoleLogSpy()
  await runTests(paths, config, client)
})

let hasSnapshot = false
async function runTests(paths: string[], config: any, client: VitestClient) {
  // need to import it before any other import, otherwise Vite optimizer will hang
  const viteClientPath = '/@vite/client'
  await import(viteClientPath)

  const { startTests, setupCommonEnv, setupSnapshotEnvironment } = await importId('vitest/browser') as typeof import('vitest/browser')

  if (!runner) {
    const { VitestTestRunner } = await importId('vitest/runners') as typeof import('vitest/runners')
    const BrowserRunner = createBrowserRunner(VitestTestRunner)
    runner = new BrowserRunner({ config, client, browserHashMap })
  }

  if (!hasSnapshot) {
    setupSnapshotEnvironment(new BrowserSnapshotEnvironment(client))
    hasSnapshot = true
  }

  try {
    await setupCommonEnv(config)
    const files = paths.map((path) => {
      return (`${config.root}/${path}`).replace(/\/+/g, '/')
    })

    const now = `${new Date().getTime()}`
    files.forEach(i => browserHashMap.set(i, now))

    await startTests(files, runner)
  }
  finally {
    await rpcDone()
    await rpc().onDone(testId)
  }
}
