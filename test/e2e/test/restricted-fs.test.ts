import { expect, test } from 'vitest'

import { runVitest } from '../../test-utils'

test('importing files in restricted fs works correctly', async () => {
  const { stderr, exitCode } = await runVitest({
    root: './fixtures/restricted-fs',
  })

  // It would fail if setupFile was not added to allowed fs
  // Failed to load url fixtures/restricted-fs/vitest.setup.js
  expect(stderr).toBe('')
  expect(exitCode).toBe(0)
})
