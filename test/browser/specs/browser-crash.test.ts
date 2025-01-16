import { expect, test } from 'vitest'
import { instances, provider, runBrowserTests } from './utils'

// TODO handle webdriverio. Currently they
// expose no trustable way to detect browser crashes.
test.runIf(provider === 'playwright')('fails gracefully when browser crashes', async () => {
  const { stderr } = await runBrowserTests({
    root: './fixtures/browser-crash',
    reporters: [['verbose', { isTTY: false }]],
    browser: {
      // webkit has no support for simulating browser crash
      instances: instances.filter(item => item.name !== 'webkit'),
    },
  })

  expect(stderr).contains('Page crashed when executing tests')
})
