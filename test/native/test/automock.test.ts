import { expect, test, vi } from 'vitest'
import basicDefault, { add, hello, squared } from '../src/basic.ts'

vi.mock(import('../src/basic.ts'))

test('squared is mocked', () => {
  expect(vi.isMockFunction(squared)).toBe(true)
  expect(vi.isMockFunction(add)).toBe(true)
  expect(squared(2)).toBe(undefined)
  expect(add(1, 1)).toBe(undefined)
  expect(hello).toBe('world')
  expect(basicDefault).toBe('hello world')
})
