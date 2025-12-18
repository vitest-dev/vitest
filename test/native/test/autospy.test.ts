import { expect, test, vi } from 'vitest'
import basicDefault, { add, hello, squared } from '../src/basic.ts'

vi.mock(import('../src/basic.ts'), { spy: true })

test('squared is mocked', () => {
  expect(vi.isMockFunction(squared)).toBe(true)
  expect(vi.isMockFunction(add)).toBe(true)
  expect(squared(2)).toBe(4)
  expect(squared).toHaveBeenCalled()

  expect(add(1, 1)).toBe(2)
  expect(add).toHaveBeenCalled()

  expect(hello).toBe('world')
  expect(basicDefault).toBe('hello world')
})
