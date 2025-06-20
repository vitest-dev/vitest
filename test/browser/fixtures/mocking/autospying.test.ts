import { expect, test, vi } from 'vitest'
import { calculator } from './src/calculator'
import * as mocks_calculator from './src/mocks_calculator'

vi.mock('./src/calculator', { spy: true })
vi.mock('./src/mocks_calculator', { spy: true })

test('correctly spies on a regular module', () => {
  expect(calculator('plus', 1, 2)).toBe(3)
  expect(calculator).toHaveBeenCalled()
})

test('spy options overrides __mocks__ folder', () => {
  expect(mocks_calculator.calculator('plus', 1, 2)).toBe(3)
  expect(mocks_calculator.calculator).toHaveBeenCalled()
})
