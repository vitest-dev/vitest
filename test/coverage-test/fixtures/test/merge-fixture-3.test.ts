import { expect, test } from 'vitest'
import { isEven } from '../src/even'
import { multiply } from '../src/math'

test('cover multiply again', () => {
  expect(multiply(20, 2)).toBe(40)
})

test('also cover another file', () => {
  expect(isEven(4)).toBe(true)
})
