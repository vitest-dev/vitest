import type { Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import type { TestProject } from 'vitest/node'
import { readFile } from 'node:fs/promises'
import { createServer } from 'node:http'

declare module 'vitest' {
  interface ProvidedContext {
    traceAppUrl: string
  }
}

let server: Server

export async function setup({ provide }: TestProject): Promise<void> {
  const html = await readFile(new URL('./app/index.html', import.meta.url))
  const script = await readFile(new URL('./app/app.js', import.meta.url))

  server = createServer((request, response) => {
    if (request.url === '/app.js') {
      response.writeHead(200, { 'Content-Type': 'text/javascript' })
      response.end(script)
      return
    }
    response.writeHead(200, { 'Content-Type': 'text/html' })
    response.end(html)
  })
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })

  const address = server.address() as AddressInfo
  provide('traceAppUrl', `http://127.0.0.1:${address.port}`)
}

export async function teardown(): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server.close(error => error ? reject(error) : resolve())
  })
}
