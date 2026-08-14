import type { BirpcOptions, PromisifyFn } from 'birpc'
import type { WebSocketEvents, WebSocketHandlers } from 'vitest'
import type { StateManager } from './state'
import { createBirpc } from 'birpc'
import { parse, stringify } from 'flatted'

export interface VitestClientOptions {
  handlers: WebSocketEvents
  reactive: <T extends object>(v: T) => T
}

export type VitestClientRpc = {
  [K in keyof WebSocketHandlers]: PromisifyFn<WebSocketHandlers[K]>
}

export interface VitestClient {
  ws: WebSocket
  state: StateManager
  rpc: VitestClientRpc
  reconnect: () => Promise<void>
}

export function createWsClient(url: string, options: VitestClientOptions): VitestClient {
  const {
    handlers,
    reactive,
  } = options

  const reconnectInterval = 2000
  const reconnectTries = 10
  let tries = reconnectTries
  const ctx = reactive<VitestClient>({
    ws: new WebSocket(url),
    state: undefined!, // initialized in createVitestClient
    rpc: undefined!,
    reconnect,
  })

  let onMessage: (data: any) => void
  const birpcHandlers = {
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
    timeout: -1,
  } satisfies BirpcOptions<WebSocketHandlers>

  ctx.rpc = createBirpc<WebSocketHandlers, WebSocketEvents>(
    handlers,
    birpcHandlers,
  )

  async function reconnect() {
    ctx.ws = new WebSocket(url)
    registerWS()
  }

  function registerWS() {
    ctx.ws.addEventListener('open', () => {
      tries = reconnectTries
    })
    ctx.ws.addEventListener('message', (v) => {
      onMessage(v.data)
    })
    ctx.ws.addEventListener('close', () => {
      tries -= 1
      if (tries > 0) {
        setTimeout(reconnect, reconnectInterval)
      }
    })
  }

  registerWS()

  return ctx
}
