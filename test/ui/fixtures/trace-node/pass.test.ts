import { expect, test } from 'vitest'

test('pass', async () => {
  await expect.poll(() => 1).toBe(1)
})
