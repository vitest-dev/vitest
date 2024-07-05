import { a } from '@vitest/cjs-lib'
import { expect, test, vi } from 'vitest'

vi.mock(import('@vitest/cjs-lib'), () => {
  return {
    a: 'mocked',
  }
})

test('mocking works correctly', () => {
  expect(a).toBe('mocked')
})
