import { expect, test } from 'vitest'
import { runBrowserTests } from './utils'

test('fails gracefully when browser crashes', async () => {
  const { stderr } = await runBrowserTests({
    root: './fixtures/browser-crash',
    reporters: [['verbose', { isTTY: false }]],
  })

  expect(stderr).toContain('Browser connection was closed while running tests. Was the page closed unexpectedly?')
})

test('vitest bails out when the iframe is no longer accessible', async () => {
  const { stderr } = await runBrowserTests({
    root: './fixtures/broken-iframe',
    reporters: [['verbose', { isTTY: false }]],
  }, [], {}, { fails: true })
  expect(stderr).toContain(
    'Cannot connect to the iframe. Did you change the location or submitted a form? If so, don\'t forget to call `event.preventDefault()` to avoid reloading the page.',
  )
  expect(stderr).toContain('Received URL: http://')
  expect(stderr).toContain('Expected: http://')
})
