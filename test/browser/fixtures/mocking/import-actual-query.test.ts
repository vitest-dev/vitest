import { expect, test, vi } from 'vitest'
import rawFactory from './src/mocks_factory?raw'

vi.mock(import('./src/mocks_factory?raw'), async (importOriginal) => {
  const original = await importOriginal()
  return {
    default: original.default.replace('mocked: boolean = false', 'mocked: boolean = "mocked!"'),
  }
})

test('factory with a query', () => {
  expect(rawFactory).toBe(`
export function calculator(_action: string, _a: number, _b: number) {
  return _a + _b
}

export const mocked: boolean = "mocked!"
`.trimStart())
})