import type { Server } from 'node:http'
import http from 'node:http'
import type { Socket } from 'node:net'
// @ts-expect-error not typed
import connect from 'connect'
import type { Connect } from 'vite'
import type { ViteResolvedConfig } from '../types/config'

export async function createVitestServer(config: ViteResolvedConfig) {
  const api = config.test.api
  if (!api?.port)
    return undefined
  let { port, host: _host, strictPort } = api
  const middlewares = connect()
  const httpServer = http.createServer(middlewares)
  const host = typeof _host === 'string' ? _host : undefined

  return new Promise<VitestServerConnection>((resolve, reject) => {
    const onError = (e: Error & { code?: string }) => {
      if (e.code === 'EADDRINUSE') {
        if (strictPort) {
          httpServer.removeListener('error', onError)
          reject(new Error(`Port ${port} is already in use`))
        }
        else {
          httpServer.listen(++port, host)
        }
      }
      else {
        httpServer.removeListener('error', onError)
        reject(e)
      }
    }

    const openSockets = new Set<Socket>()

    httpServer.on('connection', (socket) => {
      openSockets.add(socket)
      socket.on('close', () => {
        openSockets.delete(socket)
      })
    })

    httpServer.on('error', onError)

    httpServer.listen(port, host, () => {
      httpServer.removeListener('error', onError)
      resolve({
        port,
        httpServer,
        address: `http://${host || 'localhost'}:${port}`,
        middlewares,
        close() {
          return new Promise<void>((resolve) => {
            openSockets.forEach(s => s.destroy())
            httpServer.close(() => resolve())
          })
        },
      })
    })
  })
}

export interface VitestServerConnection {
  httpServer: Server
  port: number
  address: string
  middlewares: Connect.Server
  close: () => Promise<void>
}
