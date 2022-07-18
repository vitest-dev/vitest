import type { VitestClient } from '@vitest/ws-client'
import { createClient } from '@vitest/ws-client'
// eslint-disable-next-line no-restricted-imports
import type { ResolvedConfig } from 'vitest'

// @ts-expect-error mocking some node apis
globalThis.process = { env: {}, argv: [], stdout: { write: () => {} } }
globalThis.global = globalThis

export const PORT = import.meta.hot ? '51204' : location.port
export const HOST = [location.hostname, PORT].filter(Boolean).join(':')
export const ENTRY_URL = `${
  location.protocol === 'https:' ? 'wss:' : 'ws:'
}//${HOST}/__vitest_api__`

let config: ResolvedConfig | undefined
const browserHashMap = new Map<string, string>()

export const client = createClient(ENTRY_URL, {
  handlers: {
    async onPathsCollected(paths) {
      if (!paths)
        return

      // const config = __vitest_worker__.config
      const now = `${new Date().getTime()}`
      paths.forEach((i) => {
        browserHashMap.set(i, now)
      })

      await runTests(paths, config, client)
    },
  },
})

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
  const name = '/__vitest_index__'
  const { startTests, setupGlobalEnv } = (await import(name)) as unknown as typeof import('vitest/browser')

  await setupGlobalEnv(config as any)

  await startTests(paths, config as any)

  await client.rpc.onFinished()
  await client.rpc.onWatcherStart()
}
