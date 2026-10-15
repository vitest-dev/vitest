import { expect, test } from 'vitest'

test('runs in a pool that delivers the first message during listener registration', () => {
  expect(1 + 1).toBe(2)
})
