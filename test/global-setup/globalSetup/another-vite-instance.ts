import { createServer } from 'vite'
import { resolve } from 'pathe'

export async function setup() {
  const server = await createServer({
    root: resolve(__dirname, '..'),
    server: {
      port: 9988,
    },
  })

  await server.listen(9988)
  return async() => {
    await server.close()
  }
}
