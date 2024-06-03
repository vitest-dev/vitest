import { suite, test } from 'vitest'

test('hi', async () => {
  await new Promise(resolve => setTimeout(resolve, 1000))
}, 10)

suite('suite timeout', {
  timeout: 100,
}, () => {
  test('hi', async () => {
    await new Promise(resolve => setTimeout(resolve, 500))
  })
})

suite('suite timeout simple input', () => {
  test('hi', async () => {
    await new Promise(resolve => setTimeout(resolve, 500))
  })
}, 200)
