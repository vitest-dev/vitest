import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import type { Plugin } from 'vite'
import sirv from 'sirv'
import { WebSocketServer } from 'ws'
import { getSuitesAsJson } from './utils'

const _dirname = typeof __dirname !== 'undefined'
  ? __dirname
  : dirname(fileURLToPath(import.meta.url))

export const VitestUIPlugin = (): Plugin => {
  return {
    name: 'vitest:ui',
    apply: 'serve',
    async configureServer(server) {
      const wss = new WebSocketServer({ noServer: true })

      server.httpServer?.on('upgrade', (request, socket, head) => {
        if (request.url) {
          const { pathname } = new URL(request.url)

          if (pathname === '/__vitest_api') {
            wss.handleUpgrade(request, socket, head, (ws) => {
              wss.emit('connection', ws, request)

              /**
               * When user opens connection send initial list of tasks.
               */
              ws.on('message', () => {

              })
            })
          }
        }
      })

      server.middlewares.use('/__vitest_api', async(req, res) => {
        // const vitest = process.__vitest__

        // const suites = getSuites(vitest.state.getFiles())
        //   .map(suite => ({
        //     id: suite.id,
        //     name: suite.name,
        //     type: suite.type,
        //     mode: suite.mode,
        //     result: suite.result,
        //   }))

        // const info = {
        //   suites,
        // }

        res.setHeader('Content-Type', 'application/json')
        res.write(getSuitesAsJson())
        res.end()
      })

      server.middlewares.use('/', sirv(resolve(_dirname, '../dist/client'), {
        single: true,
        dev: true,
      }))
    },
  }
}
