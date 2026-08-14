import type { BirpcOptions, PromisifyFn } from 'birpc'
import type { WebSocketEvents, WebSocketHandlers } from 'vitest'
import { createBirpc } from 'birpc'
import { parse, stringify } from 'flatted'

export type VitestClientEvents = Required<Omit<WebSocketEvents, 'onPathsCollected'>>

export interface VitestClientOptions {
  handlers: VitestClientEvents
  autoReconnect?: boolean
  reconnectInterval?: number
  reconnectTries?: number
  reactive?: <T extends object>(v: T) => T
  WebSocketConstructor?: typeof WebSocket
}

export type VitestClientRpc = {
  [K in keyof WebSocketHandlers]: PromisifyFn<WebSocketHandlers[K]>
}

export interface VitestClientTransport {
  ws: WebSocket
  rpc: VitestClientRpc
  reconnect: () => Promise<void>
}

export function createWsClient(url: string, options: VitestClientOptions): VitestClientTransport {
  const {
    handlers,
    autoReconnect = true,
    reconnectInterval = 2000,
    reconnectTries = 10,
    reactive = v => v,
    WebSocketConstructor = globalThis.WebSocket,
  } = options

  let tries = reconnectTries
  const ctx = reactive<VitestClientTransport>({
    ws: new WebSocketConstructor(url),
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

  async function reconnect(reset = false) {
    if (reset) {
      tries = reconnectTries
    }
    ctx.ws = new WebSocketConstructor(url)
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
      if (autoReconnect && tries > 0) {
        setTimeout(reconnect, reconnectInterval)
      }
    })
  }

  registerWS()

  return ctx
}
