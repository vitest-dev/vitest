import { expect, test } from 'vitest'
import { instances, runBrowserTests } from './utils'

test('in-source tests don\'t run when the module is imported by the test', async () => {
  const { stderr, stdout } = await runBrowserTests({}, ['mocking.test.ts'])
  expect(stderr).toBe('')

  instances.forEach(({ browser }) => {
    expect(stdout).toReportPassedTest('test/mocking.test.ts', browser)
  })

  // there is only one file with one test inside
  // if this stops working, it will report twice as much tests
  expect(stdout).toContain(`Test Files  ${instances.length} passed`)
  expect(stdout).toContain(`Tests  ${instances.length} passed`)
})

test('in-source tests run correctly when filtered', async () => {
  const { stderr, stdout } = await runBrowserTests({}, ['actions.ts'])
  expect(stderr).toBe('')

  instances.forEach(({ browser }) => {
    expect(stdout).toReportPassedTest('src/actions.ts', browser)
  })

  // there is only one file with one test inside
  expect(stdout).toContain(`Test Files  ${instances.length} passed`)
  expect(stdout).toContain(`Tests  ${instances.length} passed`)
})
