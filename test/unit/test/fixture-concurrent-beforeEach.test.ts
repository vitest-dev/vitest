import { afterAll, beforeEach, expect, test } from 'vitest'

// this test case might look exotic, but a few conditions were required to reproduce the reported bug.
// such particular conditions are marked with "[repro]" in the comments.

let globalA = 0
let globalB = 0

interface MyFixtures {
  a: number
  b: number
}

export const myTest = test.extend<MyFixtures>({
  // [repro] fixture order must be { a, b } and not { b, a }
  a: async ({}, use) => {
    globalA++
    await new Promise<void>(resolve => setTimeout(resolve, 200)) // [repro] async fixture
    await use(globalA)
  },
  b: async ({}, use) => {
    globalB++
    await use(globalB)
  },
})

// [repro] beforeEach uses only "b"
beforeEach<MyFixtures>(({ b }) => {
  expect(b).toBeTypeOf('number')
})

afterAll(() => {
  expect([globalA, globalB]).toEqual([2, 2])
})

// [repro] concurrent test uses both "a" and "b"
myTest.concurrent('test1', async ({ a, b }) => {
  expect(a).toBeTypeOf('number')
  expect(b).toBeTypeOf('number')
})

myTest.concurrent('test2', async ({ a, b }) => {
  expect(a).toBeTypeOf('number')
  expect(b).toBeTypeOf('number')
})
