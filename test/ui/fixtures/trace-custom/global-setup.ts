import type { AddressInfo } from 'node:net'
import type { TestProject } from 'vitest/node'
import { fileURLToPath } from 'node:url'
import { preview } from 'vite'

declare module 'vitest' {
  interface ProvidedContext {
    baseURL: string
  }
}

export async function setup({ provide }: TestProject): Promise<() => Promise<void>> {
  const root = fileURLToPath(new URL('./app', import.meta.url))
  const server = await preview({
    root,
    logLevel: 'silent' as const,
    build: {
      outDir: root,
    },
    preview: {
      host: '127.0.0.1',
      port: 0,
    },
  })

  const address = server.httpServer.address() as AddressInfo
  provide('baseURL', `http://127.0.0.1:${address.port}`)
  return () => server.close()
}
