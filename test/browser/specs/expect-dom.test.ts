import { expect, test } from 'vitest'
import { instances, runBrowserTests } from './utils'

const testNames = Object.keys(import.meta.glob('../fixtures/expect-dom/*.test.ts', {
  eager: false,
})).map(path => path.slice('../fixtures/expect-dom/'.length))

test('expect-dom works correctly', async () => {
  const { stderr, stdout } = await runBrowserTests({
    root: './fixtures/expect-dom',
  })

  expect(stderr).toReportNoErrors()
  instances.forEach(({ browser }) => {
    testNames.forEach((name) => {
      expect(stdout).toReportPassedTest(name, browser)
    })
  })

  expect(stdout).toContain(`Test Files  ${instances.length * testNames.length} passed`)
})
