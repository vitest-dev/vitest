import { expect, test } from 'vitest'
import { sum } from '../src/math'
import { multiple } from './src/multiply'

test('2 x 2 = 4', () => {
  expect(multiple(2, 2)).toBe(4)
})

test('2 + 2 = 4', () => {
  expect(sum(2, 2)).toBe(4)
})
