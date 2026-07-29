import { startServer } from './server'

let teardown = false

export default async function () {
  const server = await startServer('0.0.0.0', 9876)
  return async () => {
    if (teardown) {
      throw new Error('teardown called twice')
    }
    teardown = true
    return new Promise<void>(resolve => server.close(() => resolve()))
  }
}
