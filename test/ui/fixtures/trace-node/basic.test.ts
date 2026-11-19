import { expect, test, vi } from 'vitest'

test('basic', async () => {
  await vi.waitFor(() => {})
  await expect.poll(() => 1).toBe(1)
  await expect.poll(() => 1, { timeout: 100 }).toBe(2)
})
