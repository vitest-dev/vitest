import { readFileSync } from 'node:fs'
import { expect, test, vi } from 'vitest'
// import * as vscode from 'vscode'
import { add, hello, helloMe, squared } from '../src/index.ts' // TODO: import from basic in a separate test
import { minus } from '../src/minus.ts'

// TODO: support virtual ones somehow
// vi.mock('vscode', () => {
//   return {
//     window: null,
//   }
// })

vi.mock('node:fs', async (importOriginal) => {
  // can import actual built-in module
  const _originalModule = await importOriginal()
  return {
    readFileSync: vi.fn<() => string>(() => 'mock'),
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

// TODO: test async, sync, js/ts, node_modules
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

test('importMock works', async () => {
  // wasnt't mocked by vi.mock, but importMock did
  const mockedUnmocked = await vi.importMock<typeof import('../src/no-mock.ts')>('../src/no-mock.ts')
  expect(vi.isMockFunction(mockedUnmocked.notMocked)).toBe(true)
  expect(mockedUnmocked.notMocked()).toBeUndefined()

  // redirects to correct vi.mock
  const mockedFs = await vi.importMock<typeof import('node:fs')>('node:fs')
  expect(mockedFs.readFileSync('return-value-is-mocked')).toBe('mock')

  // automocks to correct vi.mock
  const mockedIndex = await vi.importMock<typeof import('../src/index.ts')>('../src/index.ts')
  expect(mockedIndex.squared(2)).toBe(42)
  expect(mockedIndex.hello).toBe('mock')

  // redirects to __mocks__ even though vi.mock is not present in this file
  const mockedRedirect = await vi.importMock<typeof import('../src/redirect.ts')>('../src/redirect.ts')
  expect(mockedRedirect.default).toBe(true)
})

// test('can import non-existing vscode', () => {
//   expect(vscode.window).toBe(null)
// })
