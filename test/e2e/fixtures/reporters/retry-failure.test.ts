import { expect, test } from 'vitest'

test('retry failure', { retry: 2 }, () => {
  expect(1).toBe(2)
})
