import { expect, test, vi } from 'vitest'
import { calculator, mocked } from './src/mocks_factory'

vi.mock(import('./src/mocks_factory'), async (importOriginal) => {
  const original = await importOriginal()
  return {
    ...original,
    mocked: true,
  }
})

test('actual is overriding import', () => {
  expect(mocked).toBe(true)
  expect(calculator('plus', 1, 2)).toBe(3)
})
