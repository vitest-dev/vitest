import { expect, test } from 'vitest'
import { provider, runBrowserTests } from './utils'

test.runIf(provider === 'playwright')('viewport', async () => {
  const { stderr, stdout } = await runBrowserTests({
    root: './fixtures/viewport',
    reporters: [['verbose', { isTTY: false }]],
  })

  expect(stderr).toBe('')
  expect(stdout).toContain('✓ basic.test.ts')
})
