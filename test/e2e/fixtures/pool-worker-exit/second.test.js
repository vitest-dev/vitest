import { expect, test } from 'vitest'
import { covered } from './src.js'

test('second test runs cleanly so its runner can be reused for the crashing one', () => {
  expect(covered()).toBe(42)
})
