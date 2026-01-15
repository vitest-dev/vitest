import { readFileSync } from 'node:fs'
import * as tinyspy from 'tinyspy'
import { expect, test, vi } from 'vitest'
import { add, hello, helloMe, squared } from '../src/index.ts'
import { minus } from '../src/minus.ts'
import { mockJs } from '../src/mock-js.js'
import { syncMock } from '../src/mock-sync.ts'

// automocked
vi.mock(import('tinyspy'))

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

vi.mock(import('../src/mock-js.js'), async () => {
  return {
    mockJs() {
      return 42
    },
  }
})

vi.mock(import('../src/mock-sync.ts'), () => {
  return {
    syncMock() {
      return 42
    },
  }
})

vi.mock(import('../src/index.ts'), async (importOriginal) => {
  // doesn't hang even though it's circular!
  const originalModule = await importOriginal()
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

test('builtin node modules are mocked', () => {
  expect(vi.isMockFunction(readFileSync)).toBe(true)
})

test('deps in node_modules are mocked', () => {
  expect(vi.isMockFunction(tinyspy.createInternalSpy)).toBe(true)
})

test('exports are mocked', () => {
  expect(hello).toBe('mock')
  expect(helloMe).toBe('world')
  expect(add(1, 1)).toBe(42)
  expect(squared(2)).toBe(42)
  expect(minus(1, 2)).toBe(42)
  expect(syncMock()).toBe(42)
  expect(mockJs()).toBe(42)
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
