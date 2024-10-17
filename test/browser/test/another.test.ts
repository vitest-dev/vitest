import { expect, it } from 'vitest'

it('basic 3', async () => {
  expect(globalThis.window).toBeDefined()
})

it('no process', () => {
  expect(globalThis.process).toBeUndefined()
})
