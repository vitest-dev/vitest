import app from './app'

async function start() {
  try {
    await app.listen({ port: 3000 })
  }
  catch (err) {
    app.log.error(err)
    process.exit(1)
  }
}

start()
