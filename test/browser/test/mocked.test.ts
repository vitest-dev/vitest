import { expect, test, vi } from 'vitest'
import * as actions from '../src/actions'
import { calculator } from '../src/calculator'
import * as calculatorModule from '../src/calculator'

test('spyOn works on ESM', () => {
  vi.spyOn(actions, 'plus').mockReturnValue(30)
  expect(calculator('plus', 1, 2)).toBe(30)
  vi.mocked(actions.plus).mockRestore()
  expect(calculator('plus', 1, 2)).toBe(3)
})

test('has module name', () => {
  expect(String(actions)).toBe('[object Module]')
  expect(actions[Symbol.toStringTag]).toBe('Module')
})

test('exports are correct', () => {
  expect(Object.keys(actions)).toEqual(['plus'])
  expect(Object.keys(calculatorModule)).toEqual(['calculator'])
  expect(calculatorModule.calculator).toBe(calculator)
})

test('imports are still the same', async () => {
  // @ts-expect-error typescript resolution
  await expect(import('../src/calculator')).resolves.toBe(calculatorModule)
  // @ts-expect-error typescript resolution
  await expect(import(`../src/calculator`)).resolves.toBe(calculatorModule)
})
