import { expect, onTestFailed, test } from 'vitest'
import { instances, runBrowserTests } from './utils'

test('user-event', async () => {
  const { stdout, stderr } = await runBrowserTests({
    root: './fixtures/user-event',
  })
  expect(stderr).toBe('')
  onTestFailed(() => console.error(stderr))
  instances.forEach(({ browser }) => {
    expect(stdout).toReportPassedTest('cleanup-retry.test.ts', browser)
    expect(stdout).toReportPassedTest('cleanup1.test.ts', browser)
    expect(stdout).toReportPassedTest('cleanup2.test.ts', browser)
    expect(stdout).toReportPassedTest('keyboard.test.ts', browser)
    expect(stdout).toReportPassedTest('clipboard.test.ts', browser)
  })
})
