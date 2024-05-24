import { expect, test, vi } from 'vitest'
import { calculator } from './src/mocks_factory'

vi.mock(import('./src/mocks_factory'), () => {
  return {
    calculator: () => 1166
  }
})

test('adds', () => {
  expect(calculator('plus', 1, 2)).toBe(1166)
})
