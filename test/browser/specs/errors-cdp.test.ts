import { expect, test } from 'vitest'
import { provider, runBrowserTests } from './utils'

// v3 backport of
// https://github.com/vitest-dev/vitest/blob/a88ab04c710d7703b3d48c74bec4cd6382077acc/test/browser/specs/errors.test.ts#L222
test.runIf(provider === 'playwright')('cannot use cdp if write or exec is disabled', async () => {
  const { stderr } = await runBrowserTests({
    root: './fixtures/errors-cdp',
  })

  expect(stderr).toContain(
    'Cannot use CDP because browser API write or exec operations are disabled. See https://vitest.dev/config/browser/api.',
  )
})
