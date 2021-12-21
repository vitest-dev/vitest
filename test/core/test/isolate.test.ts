import { expect, it } from 'vitest'

// this should keep working after reloads
it('isolate', () => {
  const g = globalThis as any
  expect(g.fooooo).toBe(undefined)
  g.fooooo = true
  expect(g.fooooo).toBe(true)
})
