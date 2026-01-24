import { expect, test } from 'vitest'
import { instances, runBrowserTests, runInlineBrowserTests } from './utils'

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

test('disables tracking', async () => {
  const { stderr } = await runBrowserTests({
    root: './fixtures/unhandled',
    browser: {
      trackUnhandledErrors: false,
    },
  })
  expect(stderr).toBe('')
})

test('print unhandled non error', async () => {
  const { testTree, stderr } = await runBrowserTests({
    root: './fixtures/unhandled-non-error',
  })
  expect(stderr).toContain('[Error: ResizeObserver loop completed with undelivered notifications.]')
  expect(testTree()).toMatchInlineSnapshot(`
    {
      "basic.test.ts": {
        "ResizeObserver error": "passed",
      },
    }
  `)
})

test('throws an error if test reloads the iframe during a test run', async () => {
  const { stderr, fs } = await runInlineBrowserTests({
    'iframe-reload.test.ts': `
      import { test } from 'vitest';

      test('reload iframe', () => {
        location.reload();
      });
    `,
  })
  expect(stderr).toContain(
    `The iframe for "${fs.resolveFile('./iframe-reload.test.ts')}" was reloaded during a test.`,
  )
})
