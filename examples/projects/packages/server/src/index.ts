import { app } from './app.js'

app.on('error', (err) => {
  console.error(err)
  process.exit(1)
})

app.listen(3000, () => {
  // eslint-disable-next-line no-console
  console.log('> server ready at http://localhost:3000')
})
