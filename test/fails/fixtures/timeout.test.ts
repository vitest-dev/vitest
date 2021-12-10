import { test } from 'vitest'

test('hi', async() => {
  await new Promise(resolve => setTimeout(resolve, 20))
}, 10)
