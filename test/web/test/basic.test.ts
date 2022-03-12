import { it as _it, expect } from 'vitest'

const it = typeof window === 'undefined' ? _it.skip : _it

it('basic', async() => {
  expect(globalThis.performance).toBeDefined()
})

it('basic 2', () => {
  expect(globalThis.window).toBeDefined()
})
