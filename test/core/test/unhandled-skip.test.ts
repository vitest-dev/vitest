import { test } from 'vitest'

process.on('unhandledRejection', () => {
  // ignore errors
})

test('throws unhandled but not reported', () => {
  // eslint-disable-next-line no-new
  new Promise((resolve, reject) => {
    reject(new Error('promise error'))
  })
})
