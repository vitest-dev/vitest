import { expect, test, vi } from 'vitest'
import { calculator } from './src/mocks_calculator'

vi.mock(import('./src/mocks_calculator'))

test('adds', () => {
  expect(calculator('plus', 1, 2)).toBe(42)
})
