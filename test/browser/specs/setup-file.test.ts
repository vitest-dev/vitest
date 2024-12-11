// fix https://github.com/vitest-dev/vitest/issues/6690

import { expect, test } from 'vitest'
import { instances, runBrowserTests } from './utils'

test('setup file imports the same modules', async () => {
  const { stderr, stdout } = await runBrowserTests(
    {
      root: './fixtures/setup-file',
    },
  )

  expect(stderr).toReportNoErrors()

  instances.forEach(({ browser }) => {
    expect(stdout).toReportPassedTest('module-equality.test.ts', browser)
  })
})
