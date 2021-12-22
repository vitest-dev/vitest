import { fileURLToPath } from 'url'
import { dirname, resolve } from 'pathe'
import type { Plugin } from 'vite'
import sirv from 'sirv'
import { WebSocketServer } from 'ws'
import type { Vitest } from '../../vitest/src/node'
import { getSuitesAsJson } from './utils'

const _dirname = typeof __dirname !== 'undefined'
  ? __dirname
  : dirname(fileURLToPath(import.meta.url))

export const VitestUIPlugin = (vitest: Vitest): Plugin => {
  return {
    name: 'vitest:ui',
    apply: 'serve',
    async configureServer(server) {
      const wss = new WebSocketServer({ noServer: true })

      server.httpServer?.on('upgrade', (request, socket, head) => {
        if (request.url) {
          const { pathname } = new URL(request.url, request.headers.origin)

          if (pathname === '/__vitest_api') {
            wss.handleUpgrade(request, socket, head, (ws) => {
              wss.emit('connection', ws, request)

              /**
               * When user opens connection send initial list of tasks.
               */
              ws.on('message', () => {

              })

              ws.send(getSuitesAsJson(vitest))
            })
          }
        }
      })

      server.middlewares.use('/', sirv(resolve(_dirname, '../dist/client'), {
        single: true,
        dev: true,
      }))
    },
  }
}
