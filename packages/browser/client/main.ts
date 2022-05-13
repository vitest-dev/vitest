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
const webCache = new Map<string, string>()

export const client = createClient(ENTRY_URL, {
  handlers: {
    async onPathsCollected(paths) {
      if (!paths)
        return

      // const config = __vitest_worker__.config
      const now = `${new Date().getTime()}`
      paths.forEach((i) => {
        webCache.set(i, now)
      })

      await runTests(paths, config, client)
    },
  },
})

const ws = client.ws

ws.addEventListener('open', async () => {
  config = await client.rpc.getConfig()

  // @ts-expect-error mocking vitest apis
  globalThis.__vitest_worker__ = {
    config,
    webCache,
    rpc: client.rpc,
  }

  // @ts-expect-error mocking vitest apis
  globalThis.__vitest_mocker__ = {}
  const paths = await client.rpc.getPaths()

  const now = `${new Date().getTime()}`
  paths.forEach(i => webCache.set(i, now))

  const iFrame = document.getElementById('vitest-ui') as HTMLIFrameElement
  iFrame.setAttribute('src', '/__vitest__/')

  await runTests(paths, config, client)
})

async function runTests(paths: string[], config: any, client: VitestClient) {
  const { startTests, setupGlobalEnv } = (await import(
    'vitest'
  )) as unknown as typeof import('vitest/browser')

  await setupGlobalEnv(config as any)

  await startTests(paths, config as any)

  await client.rpc.onFinished()
  await client.rpc.onWatcherStart()
}
