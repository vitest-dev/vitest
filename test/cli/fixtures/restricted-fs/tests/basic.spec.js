import { expect, it } from 'vitest'
import { multiply } from '../src/math'

it('2 x 2 = 4', () => {
  expect(multiply(2, 2)).toBe(4)
  expect(multiply(2, 2)).toBe(Math.sqrt(16))
})
