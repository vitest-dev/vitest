import { expect, test } from 'vitest'
import { instances, runBrowserTests } from './utils'

test('prints correct unhandled error stack', async () => {
  const { stderr } = await runBrowserTests({
    root: './fixtures/unhandled',
  })

  expect(stderr).toContain('throw-unhandled-error.test.ts:9:10')
  expect(stderr).toContain('This error originated in "throw-unhandled-error.test.ts" test file.')
  expect(stderr).toContain('The latest test that might\'ve caused the error is "unhandled exception".')

  if (instances.some(({ browser }) => browser === 'webkit')) {
    expect(stderr).toContain('throw-unhandled-error.test.ts:9:20')
  }
})

test('ignores unhandled errors', async () => {
  const { stderr } = await runBrowserTests({
    root: './fixtures/unhandled',
    onUnhandledError(error) {
      if (error.message.includes('custom_unhandled_error')) {
        return false
      }
    },
  })

  expect(stderr).toBe('')
})
