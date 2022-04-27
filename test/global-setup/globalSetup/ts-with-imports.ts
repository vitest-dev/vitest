import { startServer } from './server'

export default async function () {
  const server = await startServer('127.0.0.1', 9876)
  return async () => new Promise<void>(resolve => server.close(() => resolve()))
}
