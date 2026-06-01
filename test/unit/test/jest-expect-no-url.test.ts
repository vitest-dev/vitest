import { expect, it } from 'vitest'

// simulate odd environment where URL is monkey-patched or not available
it('jest-expect-no-url', () => {
  (globalThis as any).URL = {}
  expect('hello').toEqual('hello')

  delete (globalThis as any).URL
  expect('hello').toEqual('hello')
})
