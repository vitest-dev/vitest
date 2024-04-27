import { suite, test } from 'vitest'

test('hi', async () => {
  await new Promise(resolve => setTimeout(resolve, 1000))
}, 10)

suite('suite timeout', () => {
  test('hi', async () => {
    await new Promise(resolve => setTimeout(resolve, 500))
  })
}, {
  timeout: 100,
})

suite('suite timeout simple input', () => {
  test('hi', async () => {
    await new Promise(resolve => setTimeout(resolve, 500))
  })
}, 200)
