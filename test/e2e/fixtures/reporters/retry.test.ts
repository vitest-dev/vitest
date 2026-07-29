import { expect, test } from 'vitest'

let number = 0

test('pass after retries', () => {
  expect(number++).toBe(3)
})
