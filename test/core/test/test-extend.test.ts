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
