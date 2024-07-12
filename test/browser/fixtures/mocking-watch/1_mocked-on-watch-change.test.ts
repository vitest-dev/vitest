import { lib } from '@vitest/cjs-lib/lib'
import { vi, test, expect } from 'vitest'

vi.mock(import('@vitest/cjs-lib/lib'), () => {
  return {
    lib: vi.fn(() => 'mocked')
  }
})

test('mocks correctly', () => {
  expect(lib()).toBe('mocked')
})
