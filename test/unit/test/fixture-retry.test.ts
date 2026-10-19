import { expect, test } from 'vitest'

let attempts = 0

const flaky = test.extend<{ value: string }>({
  value: async ({}, use) => {
    attempts++
    if (attempts === 1) {
      throw new Error('setup failed once')
    }
    await use('ready')
  },
})

flaky('fixture setup runs again on retry', { retry: 1 }, ({ value }) => {
  expect(attempts).toBe(2)
  expect(value).toBe('ready')
})
