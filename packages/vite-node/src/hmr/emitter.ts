import type { HMRPayload, Plugin } from 'vite'
import { EventEmitter } from 'node:events'
import { sourceMapCache } from '../source-map-cache'

export type EventType = string | symbol
export type Handler<T = unknown> = (event: T) => void
export interface Emitter<Events extends Record<EventType, unknown>> {
  on: <Key extends keyof Events>(
    type: Key,
    handler: Handler<Events[Key]>
  ) => void
  off: <Key extends keyof Events>(
    type: Key,
    handler?: Handler<Events[Key]>
  ) => void
  emit: (<Key extends keyof Events>(type: Key, event: Events[Key]) => void) &
    (<Key extends keyof Events>(
      type: undefined extends Events[Key] ? Key : never
    ) => void)
}

export type HMREmitter = Emitter<{
  message: HMRPayload
}> &
EventEmitter

declare module 'vite' {
  interface ViteDevServer {
    emitter: HMREmitter
  }
}

export function createHmrEmitter(): HMREmitter {
  const emitter = new EventEmitter()
  return emitter as HMREmitter
}

export function viteNodeHmrPlugin(): Plugin {
  const emitter = createHmrEmitter()
  return {
    name: 'vite-node:hmr',

    config() {
      // chokidar fsevents is unstable on macos when emitting "ready" event
      if (
        process.platform === 'darwin'
        && process.env.VITE_TEST_WATCHER_DEBUG
      ) {
        return {
          server: {
            watch: {
              useFsEvents: false,
              usePolling: false,
            },
          },
        }
      }
    },

    configureServer(server) {
      const _send = server.ws.send
      server.emitter = emitter
      server.ws.send = function (payload: any) {
        _send(payload)
        emitter.emit('message', payload)
      }
      // eslint-disable-next-line ts/ban-ts-comment
      // @ts-ignore Vite 6 compat
      const environments = server.environments
      if (environments) {
        environments.ssr.hot.send = function (payload: any) {
          _send(payload)
          emitter.emit('message', payload)
        }
      }
    },

    handleHotUpdate(ctx) {
      delete sourceMapCache[ctx.file]
    },
  }
}
