import { expect, test } from 'vitest'
import { runBrowserTests } from './utils'

test('locators work correctly', async () => {
  const { stderr, stdout } = await runBrowserTests({
    root: './fixtures/locators',
    reporters: [['verbose', { isTTY: false }]],
  })

  expect(stderr).toBe('')
  expect(stdout).toContain('✓ blog.test.tsx')
  expect(stdout).toContain('✓ query.test.ts')
  expect(stdout).toContain('Test Files  2 passed (2)')
})
