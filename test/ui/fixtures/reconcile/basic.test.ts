import { expect, test } from 'vitest'

test('reconcile-keep', () => {
  expect(1 + 1).toBe(2)
})

// TEST REMOVE START
test('reconcile-remove-me', () => {
  expect(2 + 2).toBe(4)
})
// TEST REMOVE END
