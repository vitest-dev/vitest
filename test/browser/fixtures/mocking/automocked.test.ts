import { expect, test, vi } from 'vitest'
import { calculator } from './src/calculator'

vi.mock('./src/calculator')

test('adds', () => {
  vi.mocked(calculator).mockReturnValue(4)
  expect(calculator('plus', 1, 2)).toBe(4)
})
