import { expect, test } from 'vitest'
import { instances, runBrowserTests } from './utils'

test('re-evaluate setupFiles on each test run even when isolate is false', async () => {
  const { exitCode, stderr, stdout } = await runBrowserTests({
    root: './fixtures/isolate-and-setup-file',
  })

  expect(stderr).toBe('')
  expect(exitCode).toBe(0)
  instances.forEach(({ browser }) => {
    expect(stdout).toReportPassedTest('a.test.ts', browser)
    expect(stdout).toReportPassedTest('b.test.ts', browser)
  })
})
