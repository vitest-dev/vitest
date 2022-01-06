import { expect, test } from 'vitest'
import { pythagoras } from '../src'

test('Math.sqrt()', async() => {
  expect(pythagoras(3, 4)).toBe(5)
})
