/* eslint-disable no-console */
import type { ViteNodeRunner } from 'vite-node/client'
import type { HMRPayload, ViteDevServer } from 'vite'
import { WebSocket } from 'ws'

async function handleMessage(payload: HMRPayload, runner: ViteNodeRunner, files: string[]) {
  console.log(payload)
  switch (payload.type) {
    case 'connected':
      console.log('[vite] connected.')
      break
    case 'update':
      break
    case 'full-reload':
      runner.moduleCache.clear()
      for (const file of files)
        await runner.executeFile(file)
      break
  }
}

export async function setupWatch(server: ViteDevServer, runner: ViteNodeRunner, files: string[]) {
  await server.listen()
  const { https, host, port } = server.config.server
  const socketProtocol = (https ? 'wss' : 'ws')
  const socketHost = `${host || '127.0.0.1'}:${port}`
  const ws = new WebSocket(`${socketProtocol}://${socketHost}`, 'vite-hmr')
  ws.addEventListener('message', async(data) => {
    handleMessage(JSON.parse(data.data as any), runner, files)
  })
}
