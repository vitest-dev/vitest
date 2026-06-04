import { expect, test } from 'vitest'
import { instances, runBrowserTests } from './utils'

test('inline project server options are passed to browser server', async () => {
  const { stdout, stderr } = await runBrowserTests({
    root: './fixtures/server-options-inline',
  })
  expect(stderr).toBe('')
  expect(stdout).toReportSummaryTestFiles({ passed: instances.length })
})
