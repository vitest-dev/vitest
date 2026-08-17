// https://github.com/vitest-dev/vitest/issues/10944

import { expect, test } from 'vitest'
import { instances, runBrowserTests } from './utils'

test('pre-bundled dependency shares the vitest runtime with the tester', async () => {
  const { stderr, stdout } = await runBrowserTests({
    root: './fixtures/dep-imports-vitest',
    reporters: 'verbose',
  })

  expect(stderr).toReportNoErrors()
  instances.forEach(({ browser }) => {
    expect(stdout).toReportPassedTest('basic.test.ts', `tester (${browser})`)
  })
})
