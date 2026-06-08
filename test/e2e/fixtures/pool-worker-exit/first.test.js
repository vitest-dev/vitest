import { expect, test } from 'vitest'
import { covered } from './src.js'

test('first test exercises src.js so it should appear in coverage', () => {
  expect(covered()).toBe(42)
})
