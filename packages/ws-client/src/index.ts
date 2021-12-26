import { createBirpc } from 'birpc'
import { parse, stringify } from 'flatted'
import type { WebSocketEvents, WebSocketHandlers } from '../../vitest/src/api/types'

export function createClient(url: string, fn: WebSocketEvents) {
  const ws = new WebSocket(url)

  const rpc = createBirpc<WebSocketEvents, WebSocketHandlers>({
    functions: fn,
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

  return { ws, rpc }
}
