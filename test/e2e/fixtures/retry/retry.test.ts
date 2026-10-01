import { expect, test } from 'vitest'

let number = 0
test('should passed', () => {
  expect(number++).toBe(3)
})

test('retry but still failed', () => {
  expect(number++).toBe(4)
})
