import { resolve } from 'pathe'
import { createServer } from 'vite'

let teardownHappened = false

export async function setup() {
  const server = await createServer({
    root: resolve(import.meta.dirname, '..'),
    server: {
      host: '127.0.0.1',
      port: 9988,
    },
  })

  await server.listen(9988)
  return async () => {
    if (teardownHappened) {
      throw new Error('teardown called twice')
    }
    teardownHappened = true
    await server.close()
  }
}
