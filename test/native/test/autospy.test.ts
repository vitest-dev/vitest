import { expect, test, vi } from 'vitest'
import { squared } from '../src/basic.ts'

vi.mock(import('../src/basic.ts'), { spy: true })

test('squared is mocked', () => {
  expect(vi.isMockFunction(squared)).toBe(true)
  expect(squared(2)).toBe(4)
  expect(squared).toHaveBeenCalled()
})
