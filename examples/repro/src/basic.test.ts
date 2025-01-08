import { expect, test } from 'vitest'
import { squared } from './basic'

test('repro', () => {
  expect(squared(2)).toBe(4)
})
