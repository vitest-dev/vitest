import { expect, test } from 'vitest'
import { squared, cube } from './basic'

test('repro', () => {
  expect(squared(2)).toBe(4)
  expect(cube(2)).toBe(8)
})
