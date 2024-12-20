import type { BirpcOptions, BirpcReturn } from 'birpc'
// eslint-disable-next-line no-restricted-imports
import type { WebSocketEvents, WebSocketHandlers } from 'vitest'
import { createBirpc } from 'birpc'

import { parse, stringify } from 'flatted'
import { StateManager } from './state'

export * from '../../vitest/src/utils/tasks'
export * from '@vitest/runner/utils'

export interface VitestClientOptions {
  handlers?: Partial<WebSocketEvents>
  autoReconnect?: boolean
  reconnectInterval?: number
  reconnectTries?: number
  connectTimeout?: number
  reactive?: <T>(v: T, forKey: 'state' | 'idMap' | 'filesMap') => T
  ref?: <T>(v: T) => { value: T }
  WebSocketConstructor?: typeof WebSocket
}

export interface VitestClient {
  ws: WebSocket
  state: StateManager
  rpc: BirpcReturn<WebSocketHandlers, WebSocketEvents>
  waitForConnection: () => Promise<void>
  reconnect: () => Promise<void>
}

export function createClient(url: string, options: VitestClientOptions = {}) {
  const {
    handlers = {},
    autoReconnect = true,
    reconnectInterval = 2000,
    reconnectTries = 10,
    connectTimeout = 60000,
    reactive = v => v,
    WebSocketConstructor = globalThis.WebSocket,
  } = options

  let tries = reconnectTries
  const ctx = reactive({
    ws: new WebSocketConstructor(url),
    state: new StateManager(),
    waitForConnection,
    reconnect,
  }, 'state') as VitestClient

  ctx.state.filesMap = reactive(ctx.state.filesMap, 'filesMap')
  ctx.state.idMap = reactive(ctx.state.idMap, 'idMap')

  let onMessage: (data: any) => void
  const functions: WebSocketEvents = {
    onSpecsCollected(specs) {
      specs?.forEach(([config, file]) => {
        ctx.state.clearFiles({ config }, [file])
      })
      handlers.onSpecsCollected?.(specs)
    },
    onPathsCollected(paths) {
      ctx.state.collectPaths(paths)
      handlers.onPathsCollected?.(paths)
    },
    onCollected(files) {
      ctx.state.collectFiles(files)
      handlers.onCollected?.(files)
    },
    onTaskUpdate(packs) {
      ctx.state.updateTasks(packs)
      handlers.onTaskUpdate?.(packs)
    },
    onUserConsoleLog(log) {
      ctx.state.updateUserLog(log)
      handlers.onUserConsoleLog?.(log)
    },
    onFinished(files, errors) {
      handlers.onFinished?.(files, errors)
    },
    onFinishedReportCoverage() {
      handlers.onFinishedReportCoverage?.()
    },
  }

  const birpcHandlers: BirpcOptions<WebSocketHandlers> = {
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
      throw new Error(`[vitest-ws-client]: Timeout calling "${functionName}"`)
    },
  }

  ctx.rpc = createBirpc<WebSocketHandlers, WebSocketEvents>(
    functions,
    birpcHandlers,
  )

  let openPromise: Promise<void>

  function reconnect(reset = false) {
    if (reset) {
      tries = reconnectTries
    }
    ctx.ws = new WebSocketConstructor(url)
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
