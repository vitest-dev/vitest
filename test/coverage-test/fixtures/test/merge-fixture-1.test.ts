import { expect, test } from 'vitest'
import { sum } from '../src/math'

test('cover sum', () => {
  expect(sum(1, 2)).toBe(3)
})
