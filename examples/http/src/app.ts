import { createServer as createHttpServer } from 'node:http'
import { usersData } from '../mockData'

function handleRequest(req: { method?: string, url?: string }, res: { statusCode: number, setHeader: (name: string, value: string) => void, end: (body?: string) => void }) {
  if (req.method === 'GET' && req.url === '/users') {
    res.statusCode = 200
    res.setHeader('content-type', 'application/json')
    res.end(JSON.stringify(usersData))
    return
  }

  res.statusCode = 404
  res.setHeader('content-type', 'text/plain')
  res.end('Not found')
}

function createServer() {
  return createHttpServer(handleRequest)
}

export { createServer }
