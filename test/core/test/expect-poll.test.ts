import { expect, test } from 'vitest'

test('expect.poll', async () => {
  await expect.poll(() => false).toBe(true)
})
