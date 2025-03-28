// fix https://github.com/vitest-dev/vitest/issues/6690

import { expect, test } from 'vitest'
import { instances, runBrowserTests } from './utils'

test('setup file imports the same modules', async () => {
  const { stderr, stdout } = await runBrowserTests(
    {
      root: './fixtures/setup-file',
    },
    undefined,
    {},
    {
      // TODO 2025-03-26 remove after debugging
      std: 'inherit',
    },
  )

  expect(stderr).toReportNoErrors()
  expect(stdout).toReportPassedTest('module-equality.test.ts', instances)
})
