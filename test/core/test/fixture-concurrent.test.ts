import { afterAll, beforeEach, expect, test } from 'vitest'

let i = 0

interface MyFixtures {
  a: string
  b: string
  counter: number
}

export const myTest = test.extend<MyFixtures>({
  a: async ({ task }: any, use) => {
    await new Promise<void>(resolve => setTimeout(resolve, 200))
    await use(task.id)
  },
  b: async ({ a }, use) => {
    await use(a)
  },
  counter: async ({}, use) => {
    await use(i++)
  },
})

/**
 * The `beforeEach` hook causes the issue.
 */
beforeEach<MyFixtures>(({ counter }) => {
  // this is a dummy expectation to make use of the fixture
  expect(counter).toBeTypeOf('number')
})

/**
 * Let N be the number of concurrent tests in the suite and M the number of non-concurrent tests.
 * The fixture should be invoked N+M times.
 * The issue is that it is invoked (2*N - 1) + M times.
 */
afterAll(() => {
  expect(i).toEqual(5)
})

myTest.concurrent('fixture - concurrent test 1', ({ a, b, counter, task }) => {
  expect(a).toBe(task.id)
  expect(b).toBe(task.id)
  expect(counter).toBeTypeOf('number')
})

myTest.concurrent('fixture - concurrent test 2', ({ a, b, counter, task }) => {
  expect(a).toBe(task.id)
  expect(b).toBe(task.id)
  expect(counter).toBeTypeOf('number')
})

myTest.concurrent('fixture - concurrent test 3', ({ a, b, counter, task }) => {
  expect(a).toBe(task.id)
  expect(b).toBe(task.id)
  expect(counter).toBeTypeOf('number')
})

myTest.concurrent('fixture - concurrent test 4', ({ a, b, counter, task }) => {
  expect(a).toBe(task.id)
  expect(b).toBe(task.id)
  expect(counter).toBeTypeOf('number')
})

myTest('fixture - non-concurrent test', ({ a, b, counter, task }) => {
  expect(a).toBe(task.id)
  expect(b).toBe(task.id)
  expect(counter).toBeTypeOf('number')
})
