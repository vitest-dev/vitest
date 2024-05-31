import { expect, test, vi } from 'vitest'
import { calculator } from './src/mocks_factory'

const fn = vi.hoisted(() => vi.fn())

vi.mock(import('./src/mocks_factory'), () => {
  return {
    calculator: fn,
  }
})

test('adds', () => {
  fn.mockReturnValue(448)
  expect(calculator('plus', 1, 2)).toBe(448)
})
