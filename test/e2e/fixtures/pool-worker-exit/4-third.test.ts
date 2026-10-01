import { expect, test } from 'vitest'
import { covered } from './src.js'

test('third test', () => {
  expect(covered()).toBe(42)
})
