import { describe, expect, test } from 'vitest'

test('reconcile-keep', () => {
  expect(1 + 1).toBe(2)
})

// TEST TASK TYPE CHANGE START
describe('reconcile-type-suite', () => {
  test('reconcile-type-child', () => {
    expect(3 + 3).toBe(6)
  })
})
// TEST TASK TYPE CHANGE END

// TEST REMOVE START
test('reconcile-remove-me', () => {
  expect(2 + 2).toBe(4)
})
// TEST REMOVE END
