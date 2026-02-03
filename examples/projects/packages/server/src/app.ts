import { createServer as createHttpServer } from 'node:http'
import { usersData } from '../mockData.js'

export const app = createHttpServer((req, res) => {
  if (req.method === 'GET' && req.url === '/users') {
    res.statusCode = 200
    res.setHeader('content-type', 'application/json')
    res.end(JSON.stringify(usersData))
    return
  }

  res.statusCode = 404
  res.setHeader('content-type', 'text/plain')
  res.end('Not found')
})
