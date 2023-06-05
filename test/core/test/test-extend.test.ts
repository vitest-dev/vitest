import { test as base, expect } from 'vitest'

const todoList: number[] = [1, 2, 3]
const doneList: number[] = []

const test = base
  .extend<{ todoList: number[] }>({
    todoList: async (use) => {
      await use(todoList)
      // cleanup
      todoList.length = 0
      todoList.push(1, 2, 3)
    },
  })
  .extend<{ doneList: number[] }>({
    doneList: async (use) => {
      await use(doneList)
      // cleanup
      doneList.length = 0
    },
  })

test('todoList and doneList', ({ todoList, doneList }) => {
  expect(todoList).toEqual([1, 2, 3])
  expect(doneList).toEqual([])

  doneList.push(todoList.shift()!)
  expect(todoList).toEqual([2, 3])
  expect(doneList).toEqual([1])
})

const test2 = test.extend({
  archiveList: [] as number[],
})

test2('todoList, doneList and archiveList', ({ todoList, doneList, archiveList }) => {
  expect(todoList).toEqual([1, 2, 3])
  expect(doneList).toEqual([])
  expect(archiveList).toEqual([])
})
