import * as fs from 'node:fs'
import { expect, test, vi } from 'vitest'
import basicDefault, { add, hello, squared } from '../src/basic.ts'

vi.mock(import('../src/basic.ts'))
vi.mock(import('node:fs'))

test('squared is mocked', () => {
  expect(vi.isMockFunction(squared)).toBe(true)
  expect(vi.isMockFunction(add)).toBe(true)
  expect(squared(2)).toBe(undefined)
  expect(add(1, 1)).toBe(undefined)
  expect(hello).toBe('world')
  expect(basicDefault).toBe('hello world')
})

test('fs is mocked', () => {
  expect(vi.isMockFunction(fs.readFile)).toBe(true)
  fs.readFile('path/to/file', 'utf-8', () => {})
  expect(fs.readFile).toHaveBeenCalledWith('path/to/file', 'utf-8', expect.any(Function))
})
