import { resolve } from 'pathe'
import { createServer } from 'vite'

let teardownHappened = false

export async function setup() {
  const server = await createServer({
    root: resolve(__dirname, '..'),
    server: {
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
