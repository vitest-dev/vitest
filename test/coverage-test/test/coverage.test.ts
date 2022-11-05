import { expect, test } from 'vitest'
import { pythagoras } from '../src'
import { implicitElse } from '../src/implicitElse'

test('Math.sqrt()', async () => {
  expect(pythagoras(3, 4)).toBe(5)
})

test('implicit else', () => {
  expect(implicitElse(true)).toBe(2)
})
