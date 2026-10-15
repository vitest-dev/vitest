import { expect, test } from 'vitest'
import { state } from './module-state.js'

const extended = test.extend({
  fixture: async ({}, use) => {
    await use('fixture')
  },
})

extended('keeps a heavy module graph alive', async ({ fixture }) => {
  const dynamic = await import('./module-state.js')
  expect(dynamic.state).toBe(state)
  expect(fixture).toBe('fixture')
  document.body.innerHTML = '<div>payload</div>'
})
