import type { Use } from '@vitest/runner'
import { beforeEach, describe, expect, expectTypeOf, test, vi } from 'vitest'

interface Fixtures {
  a: number
  b: number
  c: number
  d: number
}

const fnB = vi.fn()
const myTest = test.extend<Pick<Fixtures, 'a' | 'b'>>({
  a: 1,
  b: async ({ a }, use) => {
    fnB()
    await use (a * 2) // 2
    fnB.mockClear()
  },
})

const fnA = vi.fn()
const fnB2 = vi.fn()
const fnC = vi.fn()
const fnD = vi.fn()
const myTest2 = myTest.extend<Pick<Fixtures, 'c' | 'd'> & { a: string; b: string }>({
  // override origin a
  a: async ({ a: originA }, use) => {
    expectTypeOf(originA).toEqualTypeOf<number>()
    fnA()
    await use(String(originA)) // '1'
    fnA.mockClear()
  },
  b: async ({ a }, use) => {
    expectTypeOf(a).toEqualTypeOf<string>()
    fnB2()
    await use(String(Number(a) * 2)) // '2'
    fnB2.mockClear()
  },
  c: async ({ a, b }, use) => {
    expectTypeOf(b).toEqualTypeOf<string>()
    fnC()
    await use(Number(a) + Number(b)) // 3
    fnC.mockClear()
  },
  d: async ({ a, b, c }, use) => {
    fnD()
    await use(Number(a) + Number(b) + c) // 6
    fnD.mockClear()
  },
})

describe('fixture initialization', () => {
  describe('fixture override', () => {
    myTest('origin a and b', ({ a, b }) => {
      expect(a).toBe(1)
      expect(b).toBe(2)

      expectTypeOf(a).toEqualTypeOf<number>()
      expectTypeOf(b).toEqualTypeOf<number>()

      expect(fnB).toBeCalledTimes(1)

      expect(fnB2).not.toBeCalled()
      expect(fnA).not.toBeCalled()
      expect(fnC).not.toBeCalled()
      expect(fnD).not.toBeCalled()
    })

    myTest2('overriding a and b', ({ a, b }) => {
      expect(a).toBe('1')
      expect(b).toBe('2')

      expectTypeOf(a).toEqualTypeOf<string>()
      expectTypeOf(b).toEqualTypeOf<string>()

      expect(fnA).toBeCalledTimes(1)
      expect(fnB).toBeCalledTimes(1)
      expect(fnB2).toBeCalledTimes(1)

      expect(fnC).not.toBeCalled()
      expect(fnD).not.toBeCalled()
    })
  })

  myTest.runIf(true)('fixtures work with runIf', ({ a }) => {
    expect(a).toBe(1)
  })

  myTest.skipIf(false)('fixtures work with skipIf', ({ a }) => {
    expect(a).toBe(1)
  })

  describe('fixture dependency', () => {
    myTest2('b => a', ({ b }) => {
      expect(b).toBe('2')

      expect(fnA).toBeCalledTimes(1)
      expect(fnB).toBeCalledTimes(1)
      expect(fnB2).toBeCalledTimes(1)

      expect(fnC).not.toBeCalled()
      expect(fnD).not.toBeCalled()
    })

    myTest2('c => [a, b]', ({ c }) => {
      expect(c).toBe(3)

      expect(fnA).toBeCalledTimes(1)
      expect(fnB).toBeCalledTimes(1)
      expect(fnB2).toBeCalledTimes(1)
      expect(fnC).toBeCalledTimes(1)

      expect(fnD).not.toBeCalled()
    })

    myTest2('d => c', ({ d }) => {
      expect(d).toBe(6)

      expect(fnA).toBeCalledTimes(1)
      expect(fnB).toBeCalledTimes(1)
      expect(fnB2).toBeCalledTimes(1)
      expect(fnC).toBeCalledTimes(1)
      expect(fnD).toBeCalledTimes(1)
    })

    myTest2('should only call once for each fixture fn', ({ a, b, c, d }) => {
      expect(a).toBe('1')
      expect(b).toBe('2')
      expect(c).toBe(3)
      expect(d).toBe(6)

      expect(fnA).toBeCalledTimes(1)
      expect(fnB).toBeCalledTimes(1)
      expect(fnB2).toBeCalledTimes(1)
      expect(fnC).toBeCalledTimes(1)
      expect(fnD).toBeCalledTimes(1)
    })
  })

  describe('fixture dependency', () => {
    const myTest = test
      .extend({ a: 1 })
      .extend({
        b: async ({ a }, use: Use<number>) => {
          expectTypeOf(a).toEqualTypeOf<number>()
          await use(a * 2)
        },
      })

    myTest('b => a', ({ b }) => {
      expectTypeOf(b).toEqualTypeOf<number>()
      expect(b).toBe(2)
    })
  })

  describe('fixture todos', () => {
    const todos: number[] = []
    const archive: number[] = []

    const myTest = test.extend<{ todos: number[]; archive: number[] }>({
      todos: async ({}, use) => {
        // setup the fixture before each test function
        todos.push(1, 2, 3)

        // use the fixture value
        await use(todos)

        // cleanup the fixture after each test function
        todos.length = 0
      },
      archive,
    })

    myTest('add items to todos', ({ todos }) => {
      expect(todos.length).toBe(3)

      todos.push(4)
      expect(todos.length).toBe(4)
    })

    myTest('move items from todos to archive', ({ todos, archive }) => {
      expect(todos.length).toBe(3)
      expect(archive.length).toBe(0)

      archive.push(todos.pop() as number)
      expect(todos.length).toBe(2)
      expect(archive.length).toBe(1)
    })
  })

  describe('accessing non-fixture context', () => {
    const myTest = test.extend({ a: 1 })

    beforeEach(async ({ task }) => {
      expect(task).toBeTruthy()
    })

    myTest('non-fixture context can be accessed without accessing fixtures', ({ task }) => {
      expect(task).toBeTruthy()
    })
  })
})
