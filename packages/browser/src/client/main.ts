import type { VitestClient } from '@vitest/ws-client'
import { createClient } from '@vitest/ws-client'
// eslint-disable-next-line no-restricted-imports
import type { ResolvedConfig } from 'vitest'
import type { VitestRunner } from '@vitest/runner'
import { BrowserTestRunner } from './runner'

// @ts-expect-error mocking some node apis
globalThis.process = { env: {}, argv: [], stdout: { write: () => {} } }
globalThis.global = globalThis

export const PORT = import.meta.hot ? '51204' : location.port
export const HOST = [location.hostname, PORT].filter(Boolean).join(':')
export const ENTRY_URL = `${
  location.protocol === 'https:' ? 'wss:' : 'ws:'
}//${HOST}/__vitest_api__`

let config: ResolvedConfig | undefined
let runner: VitestRunner | undefined
const browserHashMap = new Map<string, string>()

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
    rpc: client.rpc,
  }

  // @ts-expect-error mocking vitest apis
  globalThis.__vitest_mocker__ = {}
  const paths = await client.rpc.getPaths()

  const now = `${new Date().getTime()}`
  paths.forEach(i => browserHashMap.set(i, now))

  const iFrame = document.getElementById('vitest-ui') as HTMLIFrameElement
  iFrame.setAttribute('src', '/__vitest__/')

  await runTests(paths, config, client)
})

async function runTests(paths: string[], config: any, client: VitestClient) {
  // we use dynamic import here, because this file is bundled with UI,
  // but we need to resolve correct path at runtime
  const path = '/__vitest_index__'
  const { startTests } = await import(path) as typeof import('vitest/browser')

  if (!runner)
    runner = new BrowserTestRunner({ config, client, browserHashMap })

  await startTests(paths, runner)

  await client.rpc.onFinished()
  await client.rpc.onWatcherStart()
}
