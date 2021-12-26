import { createBirpc } from 'birpc'
import type { WebSocket } from 'ws'
import { parse, stringify } from 'flatted'
import type { WebSocketEvents, WebSocketHandlers } from '../../vitest/src/api/types'

export async function createWebSocket(url: string): Promise<WebSocket> {
  return new ((globalThis.WebSocket || (await import('ws')).WebSocket) as any)(url)
}

export async function createClient(url: string, fn: WebSocketEvents) {
  const ws = await createWebSocket(url)

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

  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve)
    ws.addEventListener('error', reject)
  })

  return { ws, rpc }
}
