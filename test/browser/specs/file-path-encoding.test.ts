import { expect, test } from 'vitest'
import { instances, provider, runBrowserTests } from './utils'

test('runs tests from files whose path contains a plus sign', async () => {
  const { stderr, stdout, exitCode } = await runBrowserTests({
    root: './fixtures/file-path-encoding',
    reporters: ['verbose'],
    browser: {
      provider,
      instances,
    },
  })

  expect(stderr).toBe('')
  expect(exitCode).toBe(0)

  instances.forEach(({ browser }) => {
    expect(stdout).toReportPassedTest('a+b.test.ts', browser)
  })
})
