import { expect, test, vi } from 'vitest'
import { calculator, mocked } from './src/mocks_factory'
import rawFactory from './src/mocks_factory?raw'

vi.mock(import('./src/mocks_factory'), async (importOriginal) => {
  const original = await importOriginal()
  return {
    ...original,
    mocked: 'mocked!',
  }
})

vi.mock(import('./src/mocks_factory?raw'), async (importOriginal) => {
  const original = await importOriginal()
  return {
    default: original.default.replace('mocked = false', 'mocked = "mocked!"'),
  }
})

test('actual is overriding import', () => {
  expect(mocked).toBe('mocked!')
  expect(calculator('plus', 1, 2)).toBe(3)
})

test('factory with a query', () => {
  expect(rawFactory).toBe(`
export function calculator(_action: string, _a: number, _b: number) {
  return _a + _b
}

export const mocked = "mocked!"
`.trimStart())
})