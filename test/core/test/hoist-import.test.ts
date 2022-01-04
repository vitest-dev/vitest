import { expect, test, vi } from 'vitest'
// @ts-expect-error timeout doesn't have fn, mock factory adds it
import { fn, timeout } from '../src/timeout'

vi.mock('../src/timeout.ts', () => ({
  timeout: 10_000,
  fn: vi.fn(),
}))

test('"vi" can be used inside factory', () => {
  expect(globalThis.vi).toBeUndefined()
  expect(timeout).toBe(10_000)
  expect(vi.isMockFunction(fn)).toBe(true)
})
