import { expect, test } from 'vitest'
import { add } from '../../src/coverage-report/math'

test('add', () => {
  expect(add(10, 15)).toBe(25)
})
