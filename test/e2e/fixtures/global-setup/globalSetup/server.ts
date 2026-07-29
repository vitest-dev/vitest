import http from 'node:http'

export async function startServer(host: string, port: number): Promise<http.Server> {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/plain' })
      res.end('Hello Vitest\n')
    })
    server.listen(port, host, () => resolve(server))
  })
}
