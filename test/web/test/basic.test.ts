import { expect, it } from 'vitest'

it('basic', async() => {
  expect(globalThis.performance).toBeDefined()
})

it('basic 2', () => {
  expect(globalThis.window).toBeDefined()
})
