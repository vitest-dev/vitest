import { expect, test, vi } from 'vitest'
import { calculator } from './calculator'

vi.mock('./calculator')

test('the automock applies through request interception', () => {
  vi.mocked(calculator).mockReturnValue(4)
  expect(calculator('plus', 1, 2)).toBe(4)
})
