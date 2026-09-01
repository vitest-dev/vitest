import { fileURLToPath } from 'node:url'
import { interceptorPlugin } from '@vitest/mocker/node'
import { createServer } from 'vite'
import { expect, it, onTestFinished } from 'vitest'
import { WebSocket } from 'ws'

const root = fileURLToPath(
  new URL('../fixtures/mocker/redirect-security/root', import.meta.url),
)

async function createMockerServer() {
  const server = await createServer({
    root,
    configFile: false,
    logLevel: 'silent',
    server: {
      host: '127.0.0.1',
      fs: { allow: [root] },
    },
    plugins: [
      {
        name: 'test:virtual-mock',
        enforce: 'pre',
        resolveId(id) {
          if (id === '/mock') {
            return id
          }
        },
      },
      interceptorPlugin(),
    ],
  })
  await server.listen()
  onTestFinished(() => server.close())
  const port = new URL(server.resolvedUrls!.local[0]).port
  return { server, port }
}

function registerRedirect(port: string, redirect: string) {
  return new Promise<void>((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}`, 'vite-hmr')
    const timeout = setTimeout(() => {
      ws.close()
      reject(new Error('timed out waiting for the register result'))
    }, 5000)
    ws.on('message', (raw) => {
      let message: any
      try {
        message = JSON.parse(raw.toString())
      }
      catch {
        return
      }
      if (message.type === 'custom' && message.event === 'vitest:interceptor:register:result') {
        clearTimeout(timeout)
        ws.close()
        resolve()
      }
    })
    ws.on('open', () => {
      ws.send(JSON.stringify({
        type: 'custom',
        event: 'vitest:interceptor:register',
        data: { type: 'redirect', raw: '', id: '/mock', url: '/mock', redirect },
      }))
    })
    ws.on('error', reject)
  })
}

it('rejects a redirect mock whose target escapes the project root', async () => {
  const { server, port } = await createMockerServer()
  // an opaque URL scheme keeps the `..` segments, so join(root, pathname)
  // resolves outside the root; the mock must not be registered
  await registerRedirect(port, 'traversal:../secret.txt')
  const result = await server.transformRequest('/mock').catch(() => null)
  expect(result).toBe(null)
})

it('serves a redirect mock whose target stays inside the project root', async () => {
  const { server, port } = await createMockerServer()
  await registerRedirect(port, 'traversal:inroot.js')
  const result = await server.transformRequest('/mock').catch(() => null)
  expect(result?.code).toContain('in-root-redirect-ok')
})
