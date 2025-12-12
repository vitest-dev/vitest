import { readFileSync } from 'node:fs'
import { expect, test, vi } from 'vitest'
import { add, hello, helloMe, squared } from '../src/index.ts' // TODO: import from basic in a separate test
import { minus } from '../src/minus.ts'

vi.mock(import('node:fs'), () => {
  return {
    readFileSync: vi.fn(),
  }
})

vi.mock(import('../src/minus.ts'), async (importOriginal) => {
  // original module can be imported
  const _originalModule = await importOriginal()
  return {
    minus() {
      return 42
    },
  }
})

// TODO: test async, js/ts, node_modules
// TODO: mock(import('../src/basic.ts'))
vi.mock(import('../src/index.ts'), async (importOriginal) => {
  // doesn't hang because of the recursion!
  const originalModule = await importOriginal()
  // doesn't have the "hello" value yet because this factory is not resolved
  expect(originalModule.hello).toBe(undefined)
  return {
    squared() {
      return 42
    },
    add() {
      return 42
    },
    helloMe: originalModule.helloMe,
    hello: 'mock' as 'world', // keep the TS syntax to check that file is transformed
  } as const
})

// TODO: cli test that export * from './dep' doesn't work
// TODO: test errors in the factory

test('builtin node modules are mocked', () => {
  expect(vi.isMockFunction(readFileSync)).toBe(true)
})

test('squared is mocked', () => {
  expect(hello).toBe('mock')
  expect(helloMe).toBe('world')
  expect(add(1, 1)).toBe(42)
  expect(squared(2)).toBe(42)
  expect(minus(1, 2)).toBe(42)
})
