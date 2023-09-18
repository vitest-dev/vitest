import { expect, test } from 'vitest'

declare global {
  const __DEV__: boolean
}

test('dev is injected', () => {
  expect(__DEV__).toBe(true)
})
