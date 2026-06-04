import * as fs from 'node:fs'
import { expect, test, vi } from 'vitest'
import basicDefault, { add, hello, squared } from '../src/basic.ts'

vi.mock(import('../src/basic.ts'), { spy: true })
vi.mock(import('node:fs'))

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

test('fs is mocked', () => {
  expect(vi.isMockFunction(fs.readFile)).toBe(true)
  fs.readFile('path/to/file', 'utf-8', (_error) => {
    // the first argument will be an error because the file does not exist
  })
  expect(fs.readFile).toHaveBeenCalledWith('path/to/file', 'utf-8', expect.any(Function))
})
