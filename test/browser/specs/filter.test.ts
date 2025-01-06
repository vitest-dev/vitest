import { expect, test } from 'vitest'
import { instances, runBrowserTests } from './utils'

test('filter', async () => {
  const { stderr, stdout } = await runBrowserTests({
    testNamePattern: 'basic 2',
    reporters: ['verbose'],
  }, ['test/basic.test.ts'])

  expect(stderr).toBe('')
  instances.forEach(({ browser }) => {
    expect(stdout).toReportPassedTest('test/basic.test.ts > basic 2', browser)
  })
  expect(stdout).toContain(`Test Files  ${instances.length} passed`)
  expect(stdout).toContain(`Tests  ${instances.length} passed | ${instances.length * 3} skipped`)
})
