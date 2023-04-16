import { createClient } from '@vitest/ws-client'
import { createSafeRpc } from './rpc'
import { ResolvedConfig } from 'vitest'
import { VitestRunner } from '@vitest/runner'
import { createBrowserRunner } from './runner'
import { takeCoverageInsideWorker } from 'vitest/browser'

export const PORT = import.meta.hot ? '51204' : location.port
export const HOST = [location.hostname, PORT].filter(Boolean).join(':')
export const ENTRY_URL = `${
  location.protocol === 'https:' ? 'wss:' : 'ws:'
}//${HOST}/__vitest_api__`

export const browserHashMap = new Map<string, [test: boolean, timestamp: string]>()

export const client = createClient(ENTRY_URL)

export let config: ResolvedConfig | null

export async function loadConfig() {
  if (config) {
    return config
  }
  let retries = 5
  do {
    try {
      await new Promise(resolve => setTimeout(resolve, 150))
      config = await client.rpc.getConfig()
      return config
    }
    catch (_) {
      // just ignore
    }
  }
  while (--retries > 0)

  throw new Error('cannot load configuration after 5 retries')
}

export async function assignVitestGlobals() {
  const { getSafeTimers } = await importId('vitest/utils') as typeof import('vitest/utils')
  const safeRpc = createSafeRpc(client, getSafeTimers)
  await loadConfig()

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
}

let result: {channel: BroadcastChannel, runner: VitestRunner} | undefined
export async function instantiateRunner() {
  if (result) {
    return result
  }
  const channel = new BroadcastChannel('vitest-browser')
  const { VitestTestRunner } = await importId('vitest/runners') as typeof import('vitest/runners')
  const BrowserRunner = createBrowserRunner(VitestTestRunner, { takeCoverage: () => takeCoverageInsideWorker(config!.coverage, executor) })
  const runner = new BrowserRunner({ config: config!, browserHashMap, vitestBC: channel })

  result = {channel, runner}
  return result
}

export function importId(id: string) {
  const name = `/@id/${id}`
  return import(name)
}

export const executor = {
  executeId: (id: string) => importId(id),
}
