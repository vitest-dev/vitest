import { expect, test } from 'vitest'

test('async failure', async () => {
  const p = Promise.resolve(3 + 3)
  await expect(p).resolves.toEqual(7)
})

test('async failure 2', async () => {
  await expect(() => Promise.reject(3 + 3)).rejects.toEqual(7)
})
