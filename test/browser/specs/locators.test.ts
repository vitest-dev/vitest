import { expect, test } from 'vitest'
import { instances, runBrowserTests } from './utils'

test('locators work correctly', async () => {
  const { stderr, stdout } = await runBrowserTests({
    root: './fixtures/locators',
    reporters: [['verbose', { isTTY: false }]],
  })

  expect(stderr).toReportNoErrors()

  instances.forEach(({ browser }) => {
    expect(stdout).toReportPassedTest('blog.test.tsx', browser)
    expect(stdout).toReportPassedTest('query.test.ts', browser)
  })

  const COUNT_TEST_FILES = 2
  const COUNT_TESTS_OVERALL = 14

  expect(stdout).toReportSummaryTestFiles({ passed: instances.length * COUNT_TEST_FILES })
  expect(stdout).toReportSummaryTests({ passed: instances.length * COUNT_TESTS_OVERALL })
})

test('custom locators work', async () => {
  const { stderr, stdout } = await runBrowserTests({
    root: './fixtures/locators-custom',
    reporters: [['verbose', { isTTY: false }]],
  })

  expect(stderr).toReportNoErrors()

  instances.forEach(({ browser }) => {
    expect(stdout).toReportPassedTest('basic.test.tsx', browser)
  })

  const COUNT_TEST_FILES = 1
  const COUNT_TESTS_OVERALL = 5

  expect(stdout).toReportSummaryTestFiles({ passed: instances.length * COUNT_TEST_FILES })
  expect(stdout).toReportSummaryTests({ passed: instances.length * COUNT_TESTS_OVERALL })
})
