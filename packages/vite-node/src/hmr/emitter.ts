import { EventEmitter } from 'events'
import type { HMRPayload, Plugin } from 'vite'

export type EventType = string | symbol
export type Handler<T = unknown> = (event: T) => void
export interface Emitter<Events extends Record<EventType, unknown>> {
  on<Key extends keyof Events>(type: Key, handler: Handler<Events[Key]>): void
  off<Key extends keyof Events>(type: Key, handler?: Handler<Events[Key]>): void
  emit<Key extends keyof Events>(type: Key, event: Events[Key]): void
  emit<Key extends keyof Events>(type: undefined extends Events[Key] ? Key : never): void
}

export type HMREmitter = Emitter<{
  'message': HMRPayload
}> & EventEmitter

declare module 'vite' {
  interface ViteDevServer {
    emitter: HMREmitter
  }
}

export function createHmrEmitter(): HMREmitter {
  const emitter = new EventEmitter()
  return emitter
}

export function viteNodeHmrPlugin(): Plugin {
  const emitter = createHmrEmitter()
  return {
    name: 'vite-node:hmr',

    configureServer(server) {
      const _send = server.ws.send
      server.emitter = emitter
      server.ws.send = function (payload: HMRPayload) {
        _send(payload)
        emitter.emit('message', payload)
      }
    },
  }
}
