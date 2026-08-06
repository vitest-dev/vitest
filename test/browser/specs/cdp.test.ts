import { expect, test } from 'vitest'
import { instances, provider, runInlineBrowserTests } from './utils'

test.runIf(provider.name === 'playwright')('removes CDP listeners when a tester disconnects', async () => {
  const chromium = instances.find(instance => instance.browser === 'chromium')

  expect.assert(chromium)

  const { stderr, testTree } = await runInlineBrowserTests(
    {
      'a.test.ts': `
        import { test } from 'vitest'
        import { cdp } from 'vitest/browser'

        test('subscribes to console events', async () => {
          await cdp().send('Console.enable')
          cdp().on('Console.messageAdded', () => {})

          await cdp().send('Runtime.evaluate', { expression: 'undefined' })
        })
      `,
      'b.test.ts': `
        import { expect, test } from 'vitest'

        test('runs after the subscribed file', async () => {
          console.log('TRIGGER STALE CDP LISTENER')
          await new Promise(resolve => setTimeout(resolve, 50))
          expect(1).toBe(1)
        })
      `,
    },
    {
      fileParallelism: false,
      browser: {
        instances: [chromium],
      },
    },
  )

  expect(stderr).toBe('')
  expect(testTree()).toMatchInlineSnapshot(`
    {
      "a.test.ts": {
        "subscribes to console events": "passed",
      },
      "b.test.ts": {
        "runs after the subscribed file": "passed",
      },
    }
  `)
})
