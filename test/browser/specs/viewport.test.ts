import { expect, test } from 'vitest'
import { runBrowserTests } from './utils'

// this works only on playwright + chrome?
test('viewport', async () => {
  const { stderr, stdout } = await runBrowserTests({
    root: './fixtures/viewport',
    reporters: [['verbose', { isTTY: false }]],
  })

  expect(stderr).toBe('')
  expect(stdout).toContain('✓ basic.test.ts (1)')
})
