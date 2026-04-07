import { test, expect } from 'vitest'

test('replaced variable is the same', () => {
  expect(__REPLACED__).toBe(process.env.REPLACED)
})
