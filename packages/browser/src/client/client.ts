import type { ModuleMocker } from '@vitest/mocker/browser'
import type { CancelReason } from '@vitest/runner'
import type { BirpcReturn } from 'birpc'
import type { WebSocketBrowserEvents, WebSocketBrowserHandlers } from '../types'
import type { IframeOrchestrator } from './orchestrator'
import { createBirpc } from 'birpc'
import { parse, stringify } from 'flatted'
import { createWebSocketConnection } from './connection'
import { getBrowserState } from './utils'

const PAGE_TYPE = getBrowserState().type

export const PORT: string = location.port
export const HOST: string = [location.hostname, PORT].filter(Boolean).join(':')
export const RPC_ID: string
  = PAGE_TYPE === 'orchestrator'
    ? getBrowserState().sessionId
    : getBrowserState().testerId
const METHOD = getBrowserState().method
export const ENTRY_URL: string = `${
  location.protocol === 'https:' ? 'wss:' : 'ws:'
}//${HOST}/__vitest_browser_api__?type=${PAGE_TYPE}&rpcId=${RPC_ID}&sessionId=${getBrowserState().sessionId}&projectName=${encodeURIComponent(getBrowserState().config.name || '')}&method=${METHOD}&token=${(window as any).VITEST_API_TOKEN || '0'}`

const onCancelCallbacks: ((reason: CancelReason) => void)[] = []

export function onCancel(callback: (reason: CancelReason) => void): void {
  onCancelCallbacks.push(callback)
}

export interface VitestBrowserClient {
  rpc: BrowserRPC
  ws: WebSocket
  waitForConnection: () => Promise<void>
}

export type BrowserRPC = BirpcReturn<
  WebSocketBrowserHandlers,
  WebSocketBrowserEvents
>

// ws connection can be established before the orchestrator is fully loaded
// in very rare cases in the preview provider
function waitForOrchestrator() {
  return new Promise<IframeOrchestrator>((resolve, reject) => {
    const type = getBrowserState().type
    if (type !== 'orchestrator') {
      reject(new TypeError('Only orchestrator can create testers.'))
      return
    }

    function check() {
      const orchestrator = getBrowserState().orchestrator
      if (orchestrator) {
        return resolve(orchestrator)
      }
      setTimeout(check)
    }
    check()
  })
}

function createClient() {
  const connection = createWebSocketConnection({ url: ENTRY_URL })

  const ctx = {
    waitForConnection: connection.waitForConnection,
  } as VitestBrowserClient
  Object.defineProperty(ctx, 'ws', {
    get: () => connection.socket,
    enumerable: true,
  })

  ctx.rpc = createBirpc<WebSocketBrowserHandlers, WebSocketBrowserEvents>(
    {
      async onCancel(reason) {
        await Promise.all(onCancelCallbacks.map(fn => fn(reason)))
      },
      async createTesters(options) {
        const orchestrator = await waitForOrchestrator()
        return orchestrator.createTesters(options)
      },
      async cleanupTesters() {
        const orchestrator = await waitForOrchestrator()
        return orchestrator.cleanupTesters()
      },
      cdpEvent(event: string, payload: unknown) {
        const cdp = getBrowserState().cdp
        if (!cdp) {
          return
        }
        cdp.emit(event, payload)
      },
      async resolveManualMock(url: string) {
        // @ts-expect-error not typed global API
        const mocker = globalThis.__vitest_mocker__ as ModuleMocker | undefined
        const responseId = getBrowserState().sessionId
        if (!mocker) {
          return { url, keys: [], responseId }
        }
        const exports = await mocker.resolveFactoryModule(url)
        const keys = Object.keys(exports)
        return {
          url,
          keys,
          responseId,
        }
      },
    },
    {
      post: msg => connection.send(msg),
      on: fn => connection.onMessage(fn as (data: unknown) => void),
      serialize: e =>
        stringify(e, (_, v) => {
          if (v instanceof Error) {
            return {
              name: v.name,
              message: v.message,
              stack: v.stack,
            }
          }
          return v
        }),
      deserialize: parse,
      timeout: -1, // createTesters can take a while
    },
  )

  return ctx
}

export const client: VitestBrowserClient = createClient()

export * from './channel'
