import { expect, test } from 'vitest'
import { runBrowserTests } from './utils'

test('viewport', async () => {
  const { stderr, stdout } = await runBrowserTests({
    root: './fixtures/viewport',
    reporters: [['verbose', { isTTY: false }]],
  })

  expect(stderr).toBe('')
  expect(stdout).toContain('✓ basic.test.ts')
})
