import { expect, test } from 'vitest'
import { calculator } from './src/calculator'

test('adds', () => {
  expect(calculator('plus', 1, 2)).toBe(3)
})
