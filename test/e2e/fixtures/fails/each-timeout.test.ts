import { test } from 'vitest'

test.each([1])('test each timeout', async () => {
  await new Promise(resolve => setTimeout(resolve, 20))
}, 10)
