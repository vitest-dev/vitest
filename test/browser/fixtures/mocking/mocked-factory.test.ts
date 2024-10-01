import { expect, test, vi } from 'vitest'
import { calculator, mocked } from './src/mocks_factory'
import factoryMany from './src/mocks_factory_many'

vi.mock(import('./src/mocks_factory'), () => {
  return {
    calculator: () => 1166,
    mocked: true,
  }
})

vi.mock(import('./src/mocks_factory_many_dep1'), () => ({
  dep1: "dep1-mocked"
}))
vi.mock(import('./src/mocks_factory_many_dep2'), () => ({
  dep2: "dep2-mocked"
}))

test('adds', () => {
  expect(mocked).toBe(true)
  expect(calculator('plus', 1, 2)).toBe(1166)

  expect(factoryMany).toEqual({
    "dep1": "dep1-mocked",
    "dep2": "dep2-mocked",
  })
})
