import { expect, test, vi } from 'vitest'
import { calculator, mocked } from './src/mocks_factory'

vi.mock(import('./src/mocks_factory'), () => {
  return {
    calculator: () => 1166,
    mocked: true,
  }
})

test('adds', () => {
  expect(mocked).toBe(true)
  expect(calculator('plus', 1, 2)).toBe(1166)
})
