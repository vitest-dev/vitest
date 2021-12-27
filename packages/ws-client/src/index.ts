import { createBirpc } from 'birpc'
import { parse, stringify } from 'flatted'
import type { WebSocketEvents, WebSocketHandlers } from '../../vitest/src/api/types'
import { StateManager } from '../../vitest/src/node/state'

export function createClient(url: string, fn: Partial<WebSocketEvents> = {}) {
  const ws = new WebSocket(url)

  const state = new StateManager()

  const rpc = createBirpc<WebSocketEvents, WebSocketHandlers>({
    functions: {
      onCollected(files) {
        state.collectFiles(files)
        fn.onCollected?.(files)
      },
      onTaskUpdate(packs) {
        state.updateTasks(packs)
        fn.onTaskUpdate?.(packs)
      },
    },
    post(msg) {
      ws.send(msg)
    },
    on(fn) {
      ws.addEventListener('message', (v) => {
        fn(v.data)
      })
    },
    serialize: stringify,
    deserialize: parse,
  })

  return { ws, rpc, state }
}
