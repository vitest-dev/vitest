import { expect, test } from 'vitest'

export const myTest = test.extend<{
  a: string
  b: string
}>({
  a: async ({ task }: any, use) => {
    await new Promise<void>(resolve => setTimeout(resolve, 200))
    await use(task.id)
  },
  b: async ({ a }, use) => {
    await use(a)
  },
})

myTest.concurrent('fixture - concurrent test 1', ({ a, b, task }) => {
  expect(a).toBe(task.id)
  expect(b).toBe(task.id)
})

myTest.concurrent('fixture - concurrent test 2', ({ a, b, task }) => {
  expect(a).toBe(task.id)
  expect(b).toBe(task.id)
})
