import { expect, test } from 'vitest'
import { runBrowserTests } from './utils'

test('fails gracefully when browser crashes', async () => {
  const { stderr } = await runBrowserTests({
    root: './fixtures/browser-crash',
    reporters: [['verbose', { isTTY: false }]],
  })

  expect(stderr).toContain('Browser connection was closed while running tests. Was the page closed unexpectedly?')
})
