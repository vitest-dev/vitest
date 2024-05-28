// fix #4686

import { expect, test } from 'vitest'
import { runBrowserTests } from './utils'

test('tests run in presence of config.base', async () => {
  const { stderr, failedTests, passedTests, browserResultJson } = await runBrowserTests(
    {
      config: './vitest.config-basepath.mts',
    },
    ['test/basic.test.ts'],
  )

  expect(browserResultJson.testResults).toHaveLength(1)
  expect(passedTests).toHaveLength(1)
  expect(failedTests).toHaveLength(0)

  expect(stderr).toBe('')
})
