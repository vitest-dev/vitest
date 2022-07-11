import { expect, it } from 'vitest'

it('basic 3', async () => {
  console.log('basic 3')
  expect(globalThis.window).toBeDefined()
})
