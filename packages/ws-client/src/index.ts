import type { BirpcReturn } from 'birpc'
import { createBirpc } from 'birpc'
import { parse, stringify } from 'flatted'
import type { WebSocketEvents, WebSocketHandlers } from '../../vitest/src/api/types'
import { StateManager } from '../../vitest/src/node/state'

export interface VitestClientOptions {
  handlers?: Partial<WebSocketEvents>
  autoReconnect?: boolean
  reconnectInterval?: number
  reactive?: <T>(v: T) => T
  ref?: <T>(v: T) => { value: T }
}

export interface VitestClient {
  ws: WebSocket
  state: StateManager
  rpc: BirpcReturn<WebSocketHandlers>
  waitForConnection(): Promise<void>
  reconnect(): Promise<void>
}

export function createClient(url: string, options: VitestClientOptions = {}) {
  const {
    handlers = {},
    autoReconnect = true,
    reconnectInterval = 1000,
    reactive = v => v,
    // ref = v => ({ value: v }),
  } = options

  const ctx = reactive({
    ws: new WebSocket(url),
    state: new StateManager(),
    waitForConnection,
    reconnect,
  }) as VitestClient

  ctx.state.filesMap = reactive(ctx.state.filesMap)
  ctx.state.idMap = reactive(ctx.state.idMap)

  let onMessage: Function
  ctx.rpc = createBirpc<WebSocketEvents, WebSocketHandlers>({
    functions: {
      onCollected(files) {
        ctx.state.collectFiles(files)
        handlers.onCollected?.(files)
      },
      onTaskUpdate(packs) {
        ctx.state.updateTasks(packs)
        handlers.onTaskUpdate?.(packs)
      },
    },
    post(msg) {
      ctx.ws.send(msg)
    },
    on(fn) {
      onMessage = fn
    },
    serialize: stringify,
    deserialize: parse,
  })

  let openPromise: Promise<void>

  function reconnect() {
    ctx.ws = new WebSocket(url)
    registerWS()
  }

  function registerWS() {
    openPromise = new Promise((resolve) => {
      ctx.ws.addEventListener('open', () => {
        resolve()
      })
    })
    ctx.ws.addEventListener('message', (v) => {
      onMessage(v.data)
    })
    ctx.ws.addEventListener('close', () => {
      if (autoReconnect)
        setTimeout(reconnect, reconnectInterval)
    })
  }

  registerWS()

  function waitForConnection() {
    return openPromise
  }

  return ctx
}
