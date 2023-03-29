import { expect, test } from 'vitest'
import { multiple } from './src/multiply'

test('2 x 2 = 4', () => {
  expect(multiple(2, 2)).toBe(4)
})
