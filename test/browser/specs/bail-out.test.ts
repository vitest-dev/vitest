import { expect, test } from 'vitest'
import { runBrowserTests } from './utils'

test('fails gracefully when browser crashes', async () => {
  const { stderr } = await runBrowserTests({
    root: './fixtures/browser-crash',
    reporters: [['verbose', { isTTY: false }]],
  })

  // the crash is reported over CDP and as a websocket disconnect;
  // whichever arrives first fails the run
  expect(stderr).toMatch(
    /page crashed while running tests|Browser connection was closed while running tests/,
  )
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
