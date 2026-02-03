import { createServer } from './app'

const server = createServer()

server.on('error', (err) => {
  console.error(err)
  process.exit(1)
})

server.listen(3000)
