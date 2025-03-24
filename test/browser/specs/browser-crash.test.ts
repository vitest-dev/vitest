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

  // TODO 2025-03-24 whtn https://github.com/antfu/birpc/pull/23 is merged,
  // provide a better error message
  expect(stderr).toContain('rpc is closed, cannot call "createTesters"')
})
