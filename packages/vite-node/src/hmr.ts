import type { EventEmitter } from 'events'
import type { Plugin, ViteDevServer } from 'vite'

export function viteNodeHmrPlugin(event: EventEmitter): Plugin {
  let server: ViteDevServer
  return {
    name: 'vite-node-hmr',

    configureServer(_server) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      server = _server
    },

    handleHotUpdate(ctx) {
      const { modules } = ctx
      event.emit('updateModules', modules)
      return modules
    },
  }
}
