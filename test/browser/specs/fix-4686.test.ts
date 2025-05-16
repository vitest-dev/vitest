// fix #4686

import { expect, test } from 'vitest'
import { instances, runBrowserTests } from './utils'

test('tests run in presence of config.base', async () => {
  const { stderr, stdout } = await runBrowserTests(
    {
      config: './vitest.config-basepath.mts',
    },
    ['test/basic.test.ts'],
  )

  expect(stderr).toBe('')
  expect(stdout).toReportPassedTest('test/basic.test.ts', instances)
})
