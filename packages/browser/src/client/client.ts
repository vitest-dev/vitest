import type { CancelReason } from '@vitest/runner'
import type { WebSocketBrowserEvents, WebSocketBrowserHandlers } from '../node/types'
import { type BirpcReturn, createBirpc } from 'birpc'
import { parse, stringify } from 'flatted'
import { getBrowserState } from './utils'

const PAGE_TYPE = getBrowserState().type

export const PORT = location.port
export const HOST = [location.hostname, PORT].filter(Boolean).join(':')
export const RPC_ID
  = PAGE_TYPE === 'orchestrator'
    ? getBrowserState().sessionId
    : getBrowserState().testerId
const METHOD = getBrowserState().method
export const ENTRY_URL = `${
  location.protocol === 'https:' ? 'wss:' : 'ws:'
}//${HOST}/__vitest_browser_api__?type=${PAGE_TYPE}&rpcId=${RPC_ID}&sessionId=${getBrowserState().sessionId}&projectName=${getBrowserState().config.name || ''}&method=${METHOD}&token=${(window as any).VITEST_API_TOKEN}`

let setCancel = (_: CancelReason) => {}
export const onCancel = new Promise<CancelReason>((resolve) => {
  setCancel = resolve
})

export interface VitestBrowserClient {
  rpc: BrowserRPC
  ws: WebSocket
  waitForConnection: () => Promise<void>
}

export type BrowserRPC = BirpcReturn<
  WebSocketBrowserHandlers,
  WebSocketBrowserEvents
>

function createClient() {
  const autoReconnect = true
  const reconnectInterval = 2000
  const reconnectTries = 10
  const connectTimeout = 60000

  let tries = reconnectTries

  const ctx: VitestBrowserClient = {
    ws: new WebSocket(ENTRY_URL),
    waitForConnection,
  } as VitestBrowserClient

  let onMessage: Function

  ctx.rpc = createBirpc<WebSocketBrowserHandlers, WebSocketBrowserEvents>(
    {
      onCancel: setCancel,
      async createTesters(files: string[]) {
        if (PAGE_TYPE !== 'orchestrator') {
          return
        }
        getBrowserState().createTesters?.(files)
      },
      cdpEvent(event: string, payload: unknown) {
        const cdp = getBrowserState().cdp
        if (!cdp) {
          return
        }
        cdp.emit(event, payload)
      },
    },
    {
      post: msg => ctx.ws.send(msg),
      on: fn => (onMessage = fn),
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
      onTimeoutError(functionName) {
        throw new Error(`[vitest-browser]: Timeout calling "${functionName}"`)
      },
    },
  )

  let openPromise: Promise<void>

  function reconnect(reset = false) {
    if (reset) {
      tries = reconnectTries
    }
    ctx.ws = new WebSocket(ENTRY_URL)
    registerWS()
  }

  function registerWS() {
    openPromise = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(
          new Error(
            `Cannot connect to the server in ${connectTimeout / 1000} seconds`,
          ),
        )
      }, connectTimeout)?.unref?.()
      if (ctx.ws.OPEN === ctx.ws.readyState) {
        resolve()
      }
      // still have a listener even if it's already open to update tries
      ctx.ws.addEventListener('open', () => {
        tries = reconnectTries
        resolve()
        clearTimeout(timeout)
      })
    })
    ctx.ws.addEventListener('message', (v) => {
      onMessage(v.data)
    })
    ctx.ws.addEventListener('close', () => {
      tries -= 1
      if (autoReconnect && tries > 0) {
        setTimeout(reconnect, reconnectInterval)
      }
    })
  }

  registerWS()

  function waitForConnection() {
    return openPromise
  }

  return ctx
}

export const client = createClient()

export * from './channel'
