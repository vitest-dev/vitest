import { assert, expect, test, vi } from 'vitest'

// @ts-expect-error timeout doesn't have fn, mock factory adds it
import { fn, timeout } from '../src/timeout'

vi.mock('../src/timeout.ts', () => {
  assert.isEmpty([])

  return {
    timeout: 10_000,
    fn: vi.fn(),
  }
})

test('"vi" can be used inside factory with empty lines', () => {
  // @ts-expect-error no types
  expect(globalThis.vi).toBeUndefined()
  expect(timeout).toBe(10_000)
  expect(vi.isMockFunction(fn)).toBe(true)
})
