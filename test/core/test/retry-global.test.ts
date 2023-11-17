import { expect, test } from 'vitest'

let number = 0
test('should passed', () => {
  expect(number++).toBe(2)
})
