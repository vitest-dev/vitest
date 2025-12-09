import { expect, test, vi } from 'vitest'
import { squared } from '../src/basic.ts'

vi.mock(import('../src/basic.ts'))

test('squared is mocked', () => {
  expect(vi.isMockFunction(squared)).toBe(true)
  expect(squared(2)).toBe(undefined)
})
