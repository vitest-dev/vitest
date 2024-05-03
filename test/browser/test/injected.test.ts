import { expect, test } from 'vitest'

test('injected values are correct', () => {
  expect((globalThis as any).__injected).toEqual([
    1,
    2,
    3,
    4,
  ])
})
