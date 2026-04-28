import { expect, test, vi } from './proxy-module'

// This can be used only when imported directly from vitest
vi.mock('vite')

test('hi', () => {
  expect(1 + 1).toEqual(2)
})
