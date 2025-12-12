import { readFileSync } from 'node:fs'
import { expect, test, vi } from 'vitest'
import { add, squared } from '../src/index.ts' // TODO: import from basic in a separate test

vi.mock(import('node:fs'), () => {
  return {
    readFileSync: vi.fn(),
  }
})

// TODO: test async, js/ts, node_modules
vi.mock(import('../src/basic.ts'), () => {
  return {
    squared() {
      return 42
    },
    add() {
      return 42
    },
  }
})

// TODO: cli test that export * from './dep' doesn't work
// TODO: test errors in the factory

test('builtin node modules are mocked', () => {
  expect(vi.isMockFunction(readFileSync)).toBe(true)
})

test('squared is mocked', () => {
  expect(add(1, 1)).toBe(42)
  expect(squared(2)).toBe(42)
})
