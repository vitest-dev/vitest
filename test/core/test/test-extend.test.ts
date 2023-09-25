/* eslint-disable prefer-rest-params */
/* eslint-disable no-empty-pattern */
import type { InferFixturesTypes } from '@vitest/runner'
import type { TestAPI } from 'vitest'
import { describe, expect, expectTypeOf, test, vi } from 'vitest'

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
  describe('types', () => {
    interface TypesContext {
      number: number
      array: number[]
      string: string
      any: any
      boolean: boolean
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
    })

    expectTypeOf(typesTest).toEqualTypeOf<TestAPI<InferFixturesTypes<typeof typesTest>>>()
  })
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

  myTest('should called cleanup functions', ({ todoList, doneList, archiveList }) => {
    expect(todoList).toEqual([1, 2, 3])
    expect(doneList).toEqual([])
    expect(archiveList).toEqual([])
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
})
