import { expect, test, vi } from 'vitest'
import { calculator } from '../src/calculator'

vi.mock('../src/calculator')
// TODO: test factory
// TODO: test nested mocked files

test('adds', () => {
  expect(calculator('plus', 1, 2)).toBe(4)
})
