import app from "./app"

const start = async () => {
  try {
    await app.listen({ port: 3000 })
    console.log('App ready: http://localhost:3000/')
  } catch (err) {
    app.log.error(err)
    process.exit(1)
  }
}

start()
