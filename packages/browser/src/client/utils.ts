import { createClient } from '@vitest/ws-client'
import type { CancelReason, VitestRunner } from '@vitest/runner'
import { takeCoverageInsideWorker } from 'vitest/browser'
import { createBrowserRunner } from './runner'
import { createSafeRpc } from './rpc'
import { VitestBrowserClientMocker } from './mocker'
import type { ResolvedConfig } from '#types'

export const PORT = import.meta.hot ? '51204' : location.port
export const HOST = [location.hostname, PORT].filter(Boolean).join(':')
export const ENTRY_URL = `${
  location.protocol === 'https:' ? 'wss:' : 'ws:'
}//${HOST}/__vitest_api__`

export const browserHashMap = new Map<string, [test: boolean, timestamp: string]>()

let setCancel = (_: CancelReason) => {}
export const onCancel = new Promise<CancelReason>((resolve) => {
  setCancel = resolve
})

export const client = createClient(ENTRY_URL, {
  handlers: {
    onCancel: setCancel,
  },
})

let config: ResolvedConfig | null

export async function loadConfig() {
  if (config)
    return config

  let retries = 5
  do {
    try {
      config = await client.rpc.getConfig()
      return config
    }
    catch (_) {
      // just ignore
    }
    await new Promise(resolve => setTimeout(resolve, 150))
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
    environment: {
      name: 'browser',
    },
    // @ts-expect-error untyped global for internal use
    moduleCache: globalThis.__vi_module_cache__,
    rpc: client.rpc,
    safeRpc,
    durations: {
      environment: 0,
      prepare: 0,
    },
  }
  // @ts-expect-error mocking vitest apis
  globalThis.__vitest_mocker__ = new VitestBrowserClientMocker()
}

let result: { channel: BroadcastChannel; runner: VitestRunner } | undefined

export function importId(id: string) {
  const name = `/@id/${id}`
  // @ts-expect-error mocking vitest apis
  return __vi_wrap_module__(import(name))
}

export const executor = {
  executeId: (id: string) => importId(id),
}

export async function instantiateRunner() {
  if (result)
    return result

  const channel = new BroadcastChannel('vitest-browser')
  const { VitestTestRunner } = await importId('vitest/runners') as typeof import('vitest/runners')
  const BrowserRunner = createBrowserRunner(VitestTestRunner, { takeCoverage: () => takeCoverageInsideWorker(config!.coverage, executor) })
  const runner = new BrowserRunner({ config: config!, browserHashMap, vitestBC: channel })

  result = { channel, runner }

  return result
}
