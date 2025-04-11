import { expect, test } from 'vitest'
import { instances, runBrowserTests } from './utils'

test('fails gracefully when browser crashes', async () => {
  const { stderr } = await runBrowserTests({
    root: './fixtures/browser-crash',
    reporters: [['verbose', { isTTY: false }]],
    browser: {
      // webkit has no support for simulating browser crash
      instances: instances.filter(item => item.name !== 'webkit'),
    },
  })

  expect(stderr).toContain('Browser connection was closed while running tests. Was the page closed unexpectedly?')
})
