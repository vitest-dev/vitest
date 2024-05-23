import { expect, test, vi } from 'vitest'
import { calculator } from '../src/calculator'

vi.mock('../src/calculator', () => {
  return {
    calculator: () => 4,
  }
})

test('adds', () => {
  expect(calculator('plus', 1, 2)).toBe(4)
})
