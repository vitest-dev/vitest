import { test } from 'vitest'

export const myTest = test.extend<{ now: number }>({
  now: async ({}, use) => {
    await use(Date.now())
  },
})
