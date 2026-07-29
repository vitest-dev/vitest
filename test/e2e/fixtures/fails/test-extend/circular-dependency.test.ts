import { expect, test } from 'vitest'

const myTest = test.extend<{ a: number; b: number }>({
  a: async ({ b }, use) => {
    await use(b)
  },
  b: async ({ a }, use) => {
    await use(a)
  },
})

myTest('', ({ a }) => {
  expect(a).toBe(0)
})
