/* eslint-disable prefer-rest-params */

import type { InferFixturesTypes } from '@vitest/runner'
import type { TestAPI } from 'vitest'
import { afterAll, afterEach, beforeEach, describe, expect, expectTypeOf, test, vi } from 'vitest'

interface Fixtures {
  todoList: number[]
  doneList: number[]
  archiveList: number[]
}

const todoList: number[] = [1, 2, 3]
const doneList: number[] = []
const archiveList: number[] = []

const todoFn = vi.fn()
const doneFn = vi.fn()

const myTest = test
  .extend<Pick<Fixtures, 'todoList'>>({
    todoList: async ({}, use) => {
      todoFn()
      await use(todoList)
      // cleanup
      todoFn.mockClear()
      todoList.length = 0
      todoList.push(1, 2, 3)
    },
  })
  .extend<Pick<Fixtures, 'doneList' | 'archiveList'>>({
    doneList: async ({}, use) => {
      doneFn()
      await use(doneList)
      // cleanup
      doneFn.mockClear()
      doneList.length = 0
    },
    archiveList,
  })

describe('test.extend()', () => {
  test('types', () => {
    interface TypesContext {
      number: number
      array: number[]
      string: string
      any: any
      boolean: boolean
      func: (a: number, b: string) => void
    }

    const typesTest = test.extend<TypesContext>({
      number: 1,
      array: [1, 2, 3],
      async string({ }, use) {
        await use('string')
      },
      async any({}, use) {
        await use({})
      },
      boolean: true,
      func: async ({}, use): Promise<void> => {
        await use(() => undefined)
      },
    })

    expectTypeOf(typesTest).toEqualTypeOf<TestAPI<InferFixturesTypes<typeof typesTest>>>()
  })

  describe('basic', () => {
    myTest('todoList and doneList', ({ todoList, doneList, archiveList }) => {
      expect(todoFn).toBeCalledTimes(1)
      expect(doneFn).toBeCalledTimes(1)

      expectTypeOf(todoList).toEqualTypeOf<number[]>()
      expectTypeOf(doneList).toEqualTypeOf<number[]>()
      expectTypeOf(doneList).toEqualTypeOf<number[]>()

      expect(todoList).toEqual([1, 2, 3])
      expect(doneList).toEqual([])
      expect(archiveList).toEqual([])

      doneList.push(todoList.shift()!)
      expect(todoList).toEqual([2, 3])
      expect(doneList).toEqual([1])

      doneList.push(todoList.shift()!)
      expect(todoList).toEqual([3])
      expect(doneList).toEqual([1, 2])

      archiveList.push(todoList.shift()!)
      expect(todoList).toEqual([])
      expect(archiveList).toEqual([3])

      archiveList.pop()
    })
  })

  describe('smartly init fixtures', () => {
    myTest('should not init any fixtures', function () {
      expect(todoFn).not.toBeCalled()
      expect(doneFn).not.toBeCalled()

      expectTypeOf(arguments[0].todoList).not.toEqualTypeOf<number[]>()
      expectTypeOf(arguments[0].doneList).not.toEqualTypeOf<number[]>()
      expectTypeOf(arguments[0].archiveList).not.toEqualTypeOf<number[]>()

      expect(arguments[0].todoList).toBeUndefined()
      expect(arguments[0].doneList).toBeUndefined()
      expect(arguments[0].archiveList).toBeUndefined()
    })

    myTest('should not init any fixtures', function ({}) {
      expect(todoFn).not.toBeCalled()
      expect(doneFn).not.toBeCalled()

      expectTypeOf(arguments[0].todoList).not.toEqualTypeOf<number[]>()
      expectTypeOf(arguments[0].doneList).not.toEqualTypeOf<number[]>()
      expectTypeOf(arguments[0].archiveList).not.toEqualTypeOf<number[]>()

      expect(arguments[0].todoList).toBeUndefined()
      expect(arguments[0].doneList).toBeUndefined()
      expect(arguments[0].archiveList).toBeUndefined()
    })

    myTest('should only init todoList', function ({ todoList }) {
      expect(todoFn).toBeCalledTimes(1)
      expect(doneFn).not.toBeCalled()

      expectTypeOf(todoList).toEqualTypeOf<number[]>()
      expectTypeOf(arguments[0].doneList).not.toEqualTypeOf<number[]>()
      expectTypeOf(arguments[0].archiveList).not.toEqualTypeOf<number[]>()

      expect(arguments[0].doneList).toBeUndefined()
      expect(arguments[0].archiveList).toBeUndefined()
    })

    myTest('should only init todoList and doneList', function ({ todoList, doneList }) {
      expect(todoFn).toBeCalledTimes(1)
      expect(doneFn).toBeCalledTimes(1)

      expectTypeOf(todoList).toEqualTypeOf<number[]>()
      expectTypeOf(doneList).toEqualTypeOf<number[]>()
      expectTypeOf(arguments[0].archiveList).not.toEqualTypeOf<number[]>()

      expect(todoList).toEqual([1, 2, 3])
      expect(doneList).toEqual([])
      expect(arguments[0].archiveList).toBeUndefined()
    })

    myTest('should only init doneList and archiveList', function ({ doneList, archiveList }) {
      expect(doneFn).toBeCalledTimes(1)

      expectTypeOf(doneList).toEqualTypeOf<number[]>()
      expectTypeOf(archiveList).toEqualTypeOf<number[]>()
      expectTypeOf(arguments[0].todoList).not.toEqualTypeOf<number[]>()

      expect(doneList).toEqual([])
      expect(archiveList).toEqual([])
      expect(arguments[0].todoList).toBeUndefined()
    })
  })

  describe('test function', () => {
    myTest('prop alias', ({ todoList: todos, doneList: done, archiveList: archive }) => {
      expect(todoFn).toBeCalledTimes(1)
      expect(doneFn).toBeCalledTimes(1)

      expectTypeOf(todos).toEqualTypeOf<number[]>()
      expectTypeOf(done).toEqualTypeOf<number[]>()
      expectTypeOf(archive).toEqualTypeOf<number[]>()

      expect(todos).toEqual([1, 2, 3])
      expect(done).toEqual([])
      expect(archive).toEqual([])
    })
  })

  describe('fixture only in beforeEach', () => {
    beforeEach<Fixtures>(({ todoList }) => {
      expect(todoList).toEqual([1, 2, 3])
      expect(todoFn).toBeCalledTimes(1)
    })

    myTest('no fixture in test', () => {
      expect(todoFn).toBeCalledTimes(1)
    })
  })

  describe('fixture only in afterEach', () => {
    afterEach<Fixtures>(({ todoList }) => {
      expect(todoList).toEqual([1, 2, 3])
      expect(todoFn).toBeCalledTimes(1)
    })

    myTest('no fixture in test', () => {
      expect(todoFn).toBeCalledTimes(0)
    })
  })

  describe('fixture call times', () => {
    const apiFn = vi.fn(() => true)
    const serviceFn = vi.fn(() => true)
    const teardownFn = vi.fn()

    interface APIFixture {
      api: boolean
      service: boolean
    }

    const testAPI = test.extend<APIFixture>({
      api: async ({}, use) => {
        await use(apiFn())
        apiFn.mockClear()
        teardownFn()
      },
      service: async ({}, use) => {
        await use(serviceFn())
        serviceFn.mockClear()
        teardownFn()
      },
    })

    beforeEach<APIFixture>(({ api, service }) => {
      expect(api).toBe(true)
      expect(service).toBe(true)
      expect(apiFn).toBeCalledTimes(1)
      expect(serviceFn).toBeCalledTimes(1)
    })

    testAPI('Should init 1 time', ({ api }) => {
      expect(api).toBe(true)
      expect(apiFn).toBeCalledTimes(1)
    })

    testAPI('Should init 1 time has multiple fixture', ({ api, service }) => {
      expect(api).toBe(true)
      expect(service).toBe(true)
      expect(serviceFn).toBeCalledTimes(1)
      expect(apiFn).toBeCalledTimes(1)
    })

    afterEach<APIFixture>(({ api, service }) => {
      expect(api).toBe(true)
      expect(service).toBe(true)
      expect(apiFn).toBeCalledTimes(1)
      expect(serviceFn).toBeCalledTimes(1)
    })

    afterAll(() => {
      expect(serviceFn).toBeCalledTimes(0)
      expect(apiFn).toBeCalledTimes(0)
      expect(teardownFn).toBeCalledTimes(4)
    })
  })

  describe('fixture in nested describe', () => {
    interface Fixture {
      foo: number
      bar: number
    }

    const fooFn = vi.fn(() => 0)
    const fooCleanup = vi.fn()

    const barFn = vi.fn(() => 0)
    const barCleanup = vi.fn()

    const nestedTest = test.extend<Fixture>({
      async foo({}, use) {
        await use(fooFn())
        fooCleanup()
      },
      async bar({}, use) {
        await use(barFn())
        barCleanup()
      },
    })

    beforeEach<Fixture>(({ foo }) => {
      expect(foo).toBe(0)
    })

    nestedTest('should only initialize foo', ({ foo }) => {
      expect(foo).toBe(0)
      expect(fooFn).toBeCalledTimes(1)
      expect(barFn).toBeCalledTimes(0)
    })

    describe('level 2, using both foo and bar together', () => {
      beforeEach<Fixture>(({ foo, bar }) => {
        expect(foo).toBe(0)
        expect(bar).toBe(0)
      })

      nestedTest('should initialize foo and bar', ({ foo, bar }) => {
        expect(foo).toBe(0)
        expect(bar).toBe(0)
        expect(fooFn).toBeCalledTimes(2)
        expect(barFn).toBeCalledTimes(1)
      })

      afterEach<Fixture>(({ foo, bar }) => {
        expect(foo).toBe(0)
        expect(bar).toBe(0)
      })

      afterAll(() => {
        expect(barFn).toHaveBeenCalledTimes(1)
        expect(barCleanup).toHaveBeenCalledTimes(1)
        expect(fooFn).toHaveBeenCalledTimes(2)
        expect(barCleanup).toHaveBeenCalledTimes(1)
      })
    })

    nestedTest('should initialize foo again', ({ foo }) => {
      expect(foo).toBe(0)
      expect(fooFn).toBeCalledTimes(3)
    })

    afterEach<Fixture>(({ foo }) => {
      expect(foo).toBe(0)
    })

    afterAll(() => {
      expect(fooFn).toHaveBeenCalledTimes(3)
      expect(fooCleanup).toHaveBeenCalledTimes(3)
      expect(barFn).toHaveBeenCalledTimes(1)
      expect(barCleanup).toHaveBeenCalledTimes(1)
    })
  })
})

// test extend with top level test
const numbers: number[] = []
const teardownFn = vi.fn()
const teardownTest = test.extend<{
  numbers: number[]
}>({
  numbers: async ({}, use) => {
    numbers.push(1, 2, 3)
    await use(numbers)
    numbers.splice(0, numbers.length)
    teardownFn()
  },
})

teardownTest('test without describe', ({ numbers }) => {
  expect(numbers).toHaveLength(3)
})

test('teardown should be called once time', () => {
  expect(numbers).toHaveLength(0)
  expect(teardownFn).toBeCalledTimes(1)
})

describe('asynchronous setup/teardown', () => {
  const trackFn = vi.fn()

  const myTest = test.extend<{ a: string }>({
    a: async ({}, use) => {
      trackFn('setup-sync')
      await new Promise(resolve => setTimeout(resolve, 200))
      trackFn('setup-async')
      await use('ok')
      trackFn('teardown-sync')
      await new Promise(resolve => setTimeout(resolve, 200))
      trackFn('teardown-async')
    },
  })

  myTest('quick test', ({ a }) => {
    expect(a).toBe('ok')
    expect(trackFn.mock.calls).toEqual([['setup-sync'], ['setup-async']])
  })

  afterAll(() => {
    expect(trackFn.mock.calls).toEqual([
      ['setup-sync'],
      ['setup-async'],
      ['teardown-sync'],
      ['teardown-async'],
    ])
  })
})

describe('scoping variables to suite', () => {
  const testAPI = test.extend<{
    dependency: string
    pkg: { dependency: string }
  }>({
    dependency: 'default',
    pkg: ({ dependency }, use) => use({ dependency }),
  })

  testAPI('uses default values', ({ pkg }) => {
    expect(pkg).toEqual({ dependency: 'default' })
  })

  describe('override dependency', () => {
    testAPI.override({ dependency: 'new' })

    testAPI('uses new values', ({ pkg }) => {
      expect(pkg).toEqual({ dependency: 'new' })
    })

    describe('nested keeps parent scope', () => {
      testAPI('keeps using new values', ({ pkg }) => {
        expect(pkg).toEqual({ dependency: 'new' })
      })
    })

    describe('override nested overridden scope', () => {
      testAPI.override({ dependency: 'override' })

      testAPI('keeps using new values', ({ pkg }) => {
        expect(pkg).toEqual({ dependency: 'override' })
      })
    })

    testAPI('uses new values', ({ pkg }) => {
      expect(pkg).toEqual({ dependency: 'new' })
    })
  })

  testAPI('keeps using default values', ({ pkg }) => {
    expect(pkg).toEqual({ dependency: 'default' })
  })

  describe('override the pkg too', () => {
    testAPI.override({ pkg: { dependency: 'override' } })

    testAPI('uses new values', ({ pkg }) => {
      expect(pkg).toEqual({ dependency: 'override' })
    })
  })

  describe('override as dynamic', () => {
    testAPI.override({ dependency: ({}, use) => use('override') })

    testAPI('uses new values', ({ pkg }) => {
      expect(pkg).toEqual({ dependency: 'override' })
    })
  })

  describe.skip('type only', () => {
    testAPI.override({
      // @ts-expect-error nonExisting is not defined on the testAPI
      nonExisting: false,
    })
  })
})

describe('test.scoped repro #7793', () => {
  const extendedTest = test.extend<{ foo: boolean }>({
    foo: false,
  })

  describe('top level', () => {
    extendedTest.override({ foo: true })

    describe('second level', () => {
      extendedTest('foo is true', ({ foo }) => {
        expect(foo).toBe(true)
      })
    })
  })
})

describe('test.scoped repro #7813', () => {
  const extendedTest = test.extend<{ foo?: boolean }>({
    foo: false,
  })

  describe('foo is scoped to true', () => {
    extendedTest.override({ foo: true })

    extendedTest('foo is true', ({ foo }) => {
      expect(foo).toBe(true)
    })
  })

  describe('foo is left as default of false', () => {
    extendedTest('foo is false', ({ foo }) => {
      expect(foo).toBe(false)
    })
  })
})

describe('test.scoped repro #9305', () => {
  const extendedTest = test.extend<{
    a: number
    b: number
    numbers: number[]
  }>({
    a: 1,
    b: 2,
    numbers: async ({ a }, use) => use([a]),
  })

  describe('suite with overwritten fixture', () => {
    extendedTest.override({
      numbers: async ({ a, b }, use) => use([a, b]),
    })

    extendedTest('scoped fixture can access dependencies from original test', async ({
      numbers,
    }) => {
      expect(numbers).toStrictEqual([1, 2])
    })
  })
})

describe('suite with timeout', () => {
  test.extend({})('timeout is inherited from suite', ({ task }) => {
    expect(task.timeout).toBe(100)
  })

  test.extend({})('timeout is inherited from options', { timeout: 1_000 }, ({ task }) => {
    expect(task.timeout).toBe(1_000)
  })
}, 100)

const counterTest = test.extend<{
  counter: { value: number }
  fileCounter: { value: number }
}>({
  counter: async ({}, use) => { await use({ value: 0 }) },
  fileCounter: [async ({}, use) => { await use({ value: 0 }) }, { scope: 'file' }],
})

counterTest.describe('type-safe fixture hooks', () => {
  counterTest.beforeEach(({ counter }) => {
    // shouldn't have typescript error because of 'counter' here
    counter.value += 1
  })

  counterTest.afterEach(({ fileCounter }) => {
    // shouldn't have typescript error because of 'fileCounter' here
    fileCounter.value += 2
  })

  // beforeAll and afterAll hooks are not tested here, because they don't provide an extra context

  counterTest('beforeEach fixture hook can adapt type-safe context', ({ counter }) => {
    expect(counter.value).toBe(1)
  })

  counterTest('afterEach fixture hook can adapt type-safe context', ({ fileCounter }) => {
    expect(fileCounter.value).toBe(2)
  })
})

// Use the scoped fixtures approach with { $test, $file, $worker } structure
const helperTest = test.extend<{
  $worker: { workerFixture: boolean }
  $file: { fileFixture: number }
  $test: { testFixture: string }
}>({
  workerFixture: [async ({}, use) => {
    await use(true)
  }, { scope: 'worker' }],
  fileFixture: [async ({ workerFixture }, use) => {
    expectTypeOf(workerFixture).toEqualTypeOf<boolean>()
    await use(workerFixture ? 42 : 0)
  }, { scope: 'file' }],
  testFixture: async ({ fileFixture, workerFixture }, use) => {
    expectTypeOf(fileFixture).toEqualTypeOf<number>()
    expectTypeOf(workerFixture).toEqualTypeOf<boolean>()
    await use(`test-${fileFixture}-${workerFixture}`)
  },
})

helperTest.describe('scoped fixtures with tuple syntax', () => {
  helperTest('fixtures should have correct types', ({ testFixture, fileFixture, workerFixture }) => {
    expectTypeOf(workerFixture).toEqualTypeOf<boolean>()
    expectTypeOf(fileFixture).toEqualTypeOf<number>()
    expectTypeOf(testFixture).toEqualTypeOf<string>()

    expect(workerFixture).toBe(true)
    expect(fileFixture).toBe(42)
    expect(testFixture).toBe('test-42-true')
  })
})

describe('builder pattern with non-function values', () => {
  const nonFnTest = test
    .extend('stringValue', 'hello')
    .extend('numberValue', 42)
    .extend('arrayValue', [1, 2, 3])
    .extend('objectValue', { key: 'value', nested: { a: 1 } })

  nonFnTest('non-function values are provided correctly', ({ stringValue, numberValue, arrayValue, objectValue }) => {
    expectTypeOf(stringValue).toEqualTypeOf<string>()
    expectTypeOf(numberValue).toEqualTypeOf<number>()
    expectTypeOf(arrayValue).toEqualTypeOf<number[]>()
    expectTypeOf(objectValue).toEqualTypeOf<{ key: string; nested: { a: number } }>()

    expect(stringValue).toBe('hello')
    expect(numberValue).toBe(42)
    expect(arrayValue).toEqual([1, 2, 3])
    expect(objectValue).toEqual({ key: 'value', nested: { a: 1 } })
  })

  const mixedTest = test
    .extend('config', { port: 3000, host: 'localhost' })
    .extend('url', async ({ config }) => {
      expectTypeOf(config).toEqualTypeOf<{ port: number; host: string }>()
      return `http://${config.host}:${config.port}`
    })

  mixedTest('non-function values can be used by function fixtures', ({ config, url }) => {
    expectTypeOf(config).toEqualTypeOf<{ port: number; host: string }>()
    expectTypeOf(url).toEqualTypeOf<string>()

    expect(config).toEqual({ port: 3000, host: 'localhost' })
    expect(url).toBe('http://localhost:3000')
  })

  // Test that synchronous (non-async) functions work in the builder pattern
  const syncTest = test
    .extend('prefix', 'hello')
    .extend('syncValue', ({ prefix }) => {
      // This is a synchronous function - no async/await needed
      return `${prefix} world`
    })
    .extend('chainedSync', ({ syncValue }) => {
      // Another sync function that depends on the previous one
      return syncValue.toUpperCase()
    })

  syncTest('synchronous functions work in builder pattern', ({ prefix, syncValue, chainedSync }) => {
    expectTypeOf(prefix).toEqualTypeOf<string>()
    expectTypeOf(syncValue).toEqualTypeOf<string>()
    expectTypeOf(chainedSync).toEqualTypeOf<string>()

    expect(prefix).toBe('hello')
    expect(syncValue).toBe('hello world')
    expect(chainedSync).toBe('HELLO WORLD')
  })
})
