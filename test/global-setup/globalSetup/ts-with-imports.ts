import { startServer } from './server'

export default async function () {
  const server = await startServer('0.0.0.0', 9876)
  return async () => new Promise<void>(resolve => server.close(() => resolve()))
}
