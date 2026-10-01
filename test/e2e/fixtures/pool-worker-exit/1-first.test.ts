import { expect, test } from 'vitest'
import { covered } from './src'

test('first test exercises src so it should appear in coverage', () => {
  expect(covered()).toBe(42)
})
