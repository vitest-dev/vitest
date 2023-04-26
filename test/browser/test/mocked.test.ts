import { expect, test, vi } from 'vitest'
import * as actions from '../src/actions'
import { calculator } from '../src/calculator'

test('spyOn works on ESM', () => {
  vi.spyOn(actions, 'plus').mockReturnValue(30)
  expect(calculator('plus', 1, 2)).toBe(30)
  vi.mocked(actions.plus).mockRestore()
  expect(calculator('plus', 1, 2)).toBe(3)
})
