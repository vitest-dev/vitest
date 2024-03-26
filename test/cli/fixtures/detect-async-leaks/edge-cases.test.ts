import http from 'node:http'
import { TLSSocket } from 'node:tls'
import { suite, test } from 'vitest'

suite('should collect', () => {
  test.todo('handles indirectly triggered by user code', async () => {
    // const server = new http.Server()
    // await new Promise(r => server.listen({ host: 'localhost', port: 0 }, r))
    // await new Promise(r => server.close(r))
  })
})

suite('should not collect', () => {
  test('handles that have been queued to close', async () => {
    const server = http.createServer((_, response) => response.end('ok'))
    // @ts-expect-error let me go
    await new Promise(r => server.listen(0, r))
    await new Promise(r => server.close(r))
  })
  test('some special objects such as `TLSWRAP`', async () => {
    // @ts-expect-error let me go
    const socket = new TLSSocket()
    socket.destroy()
  })
})
