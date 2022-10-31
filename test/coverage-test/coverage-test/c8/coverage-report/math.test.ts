import { expect, test } from 'vitest'
import { add, multiply } from '../../../src/coverage-report/math'

test('add', () => {
  expect(add(10, 15)).toBe(25)
})

test('multiply', () => {
  expect(multiply(2, 5)).toBe(10)
})
