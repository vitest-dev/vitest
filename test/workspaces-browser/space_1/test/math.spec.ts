import { expect, test } from 'vitest'
import { sum } from '../../src/math'

test('3 + 3 = 6', () => {
  expect(sum(3, 3)).toBe(6)
})
