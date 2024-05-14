import { expect, test } from 'vitest'

test('expect.poll', async () => {
  await expect.poll(() => false).toBe(false)
  await expect.poll(() => false).not.toBe(true)
  await expect(Promise.resolve(1)).resolves.toBe(1)
})
