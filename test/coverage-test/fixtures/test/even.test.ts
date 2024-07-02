import { expect, test } from 'vitest'
import { isEven } from '../src/even'

test('isEven', () => {
  expect(isEven(6)).toBe(true)
})
