import { expect, test, vi } from 'vitest'
import { calculator } from './calculator'

vi.mock('./calculator', () => ({ calculator: () => 42 }))

test('the factory applies through request interception', () => {
  expect(calculator('plus', 1, 2)).toBe(42)
})
