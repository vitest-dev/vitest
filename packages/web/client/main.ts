import type { VitestClient } from '@vitest/ws-client'
import { createClient } from '@vitest/ws-client'

// @ts-expect-error mocking some node apis
globalThis.process = { env: {}, argv: [], stdout: { write: () => {} } }
globalThis.global = globalThis

export const PORT = import.meta.hot ? '51204' : location.port
export const HOST = [location.hostname, PORT].filter(Boolean).join(':')
export const ENTRY_URL = `${
  location.protocol === 'https:' ? 'wss:' : 'ws:'
}//${HOST}/__vitest_api__`

export const client = createClient(ENTRY_URL, {
  handlers: {
    async onPathsCollected(paths) {
      if (!paths)
        return

      const config = __vitest_worker__.config

      await runTests(paths, config, client)
    },
  },
})

const ws = client.ws

ws.addEventListener('open', async() => {
  const config = await client.rpc.getConfig()

  // @ts-expect-error mocking vitest apis
  globalThis.__vitest_worker__ = {
    config,
    rpc: client.rpc,
  }

  // @ts-expect-error mocking vitest apis
  globalThis.__vitest_mocker__ = {}
  const paths = await client.rpc.getPaths()

  await runTests(paths, config, client)
})

async function runTests(paths: string[], config: any, client: VitestClient) {
  const { startTests, setupGlobalEnv } = (await import(
    'vitest'
  )) as unknown as typeof import('vitest/dist/web')

  await setupGlobalEnv(config as any)

  await startTests(paths, config as any)

  await client.rpc.onFinished()
  await client.rpc.onWatcherStart()
}
