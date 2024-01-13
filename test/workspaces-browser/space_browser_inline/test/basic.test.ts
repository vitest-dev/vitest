import { expect, test } from 'vitest'

test('window is defined', () => {
  expect(typeof window).toBe('object')
})

test('"define" from workspace inline config', () => {
  // @ts-expect-error vite define
  expect(TEST_DEFINE).toBe('hello')
})
