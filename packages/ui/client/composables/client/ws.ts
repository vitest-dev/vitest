import type { BirpcOptions, PromisifyFn } from 'birpc'
import type { WebSocketEvents, WebSocketHandlers } from 'vitest'
import { createBirpc } from 'birpc'
import { parse, stringify } from 'flatted'
import { reactive, shallowRef } from 'vue'
import { StateManager } from './state'

export interface VitestClientOptions {
  handlers: WebSocketEvents
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
  } = options

  const reconnectInterval = 2000
  const reconnectTries = 10
  let tries = reconnectTries
  const ctx = reactive<VitestClient>({
    ws: new WebSocket(url),
    state: new StateManager(),
    rpc: undefined!,
    reconnect,
  }) as VitestClient

  // TODO: This is effectively a no-op: `state` already exposes reactive Map proxies,
  // and `shallowRef` wraps those same proxies. Revisit the intended optimization from
  // https://github.com/vitest-dev/vitest/pull/5906.
  ctx.state.filesMap = shallowRef(ctx.state.filesMap) as any
  ctx.state.idMap = shallowRef(ctx.state.idMap) as any

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
