import { expect, test } from 'vitest'
import { value } from './lib.js'

test('it passes', () => {
  expect(value).toBe(42)
})
