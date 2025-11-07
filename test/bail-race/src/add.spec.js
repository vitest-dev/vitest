import { expect, test } from 'vitest'

import { add } from './add.js'

test('adds two numbers', () => {
  const result = add(2, 3)
  expect(result).toBe(5)
})
test('fails adding two numbers', () => {
  const result = add(2, 3)
  expect(result).toBe(6)
})
