/* eslint-disable no-empty-pattern */
/* eslint-disable prefer-rest-params */
import { describe, expect, expectTypeOf, test, vi } from 'vitest'

const todoList: number[] = [1, 2, 3]
const doneList: number[] = []
const archiveList: number[] = []

const todoFn = vi.fn().mockImplementation(async (use) => {
  await use(todoList)
  // cleanup
  todoFn.mockClear()
  todoList.length = 0
  todoList.push(1, 2, 3)
})

const doneFn = vi.fn().mockImplementation(async (use) => {
  await use(doneList)
  // cleanup
  doneFn.mockClear()
  doneList.length = 0
})

const myTest = test
  .extend<{ todoList: number[] }>({
    todoList: todoFn,
  })
  .extend<{ doneList: number[]; archiveList: number[] }>({
    doneList: doneFn,
    archiveList,
  })

describe('test.extend()', () => {
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
  })

  myTest('should called cleanup functions', ({ todoList, doneList, archiveList }) => {
    expect(todoList).toEqual([1, 2, 3])
    expect(doneList).toEqual([])
    expect(archiveList).toEqual([3])
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

    myTest('should init all fixtures', ({ todoList, ...rest }) => {
      expect(todoFn).toBeCalledTimes(1)
      expect(doneFn).toBeCalledTimes(1)

      expectTypeOf(todoList).toEqualTypeOf<number[]>()
      expectTypeOf(rest.doneList).toEqualTypeOf<number[]>()
      expectTypeOf(rest.archiveList).toEqualTypeOf<number[]>()

      expect(todoList).toEqual([1, 2, 3])
      expect(rest.doneList).toEqual([])
      expect(rest.archiveList).toEqual([3])
    })

    myTest('should init all fixtures', (context) => {
      expect(todoFn).toBeCalledTimes(1)
      expect(doneFn).toBeCalledTimes(1)

      expectTypeOf(context.todoList).toEqualTypeOf<number[]>()
      expectTypeOf(context.doneList).toEqualTypeOf<number[]>()
      expectTypeOf(context.archiveList).toEqualTypeOf<number[]>()

      expect(context.todoList).toEqual([1, 2, 3])
      expect(context.doneList).toEqual([])
      expect(context.archiveList).toEqual([3])
    })
  })
})
