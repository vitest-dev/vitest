import { expect, test } from 'vitest'

test('2 + 3 = 5', () => {
  expect(2 + 3).toBe(5)
})

test.skip('3 + 3 = 6', () => {
  expect(3 + 3).toBe(6)
})
