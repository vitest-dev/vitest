import { expect, test } from 'vitest'
import { instances, runInlineBrowserTests } from './utils'

// clicking <a href="" target="_blank"> opens the tester URL (query string included)
// as a top-level window — the duplicate tester must not join the iframe channel
test('a popup opened at the tester URL does not corrupt the iframe channel', { timeout: 60_000 }, async () => {
  const { stderr, exitCode, testTree } = await runInlineBrowserTests(
    {
      'popup.test.ts': `
        import { expect, test } from 'vitest'
        import { userEvent } from 'vitest/browser'

        test('clicking a target="_blank" anchor', async () => {
          const anchor = document.createElement('a')
          // href="" resolves to location.href — the tester page itself
          anchor.setAttribute('href', '')
          anchor.setAttribute('target', '_blank')
          anchor.textContent = 'open'
          document.body.appendChild(anchor)

          // real user gesture so the browser allows the popup
          await userEvent.click(anchor)

          // give the popup time to boot the duplicate tester
          await new Promise(resolve => setTimeout(resolve, 1000))

          expect(anchor.target).toBe('_blank')
        })
      `,
      // more execute/cleanup events after the duplicate tester exists
      'second.test.ts': `
        import { expect, test } from 'vitest'

        test('a following test file still runs cleanly', () => {
          expect(1 + 1).toBe(2)
        })
      `,
    },
    {
      // fail fast: a corrupted channel loses the real tester's `ack:cleanup`
      env: { VITEST_BROWSER_IFRAME_TIMEOUT: '10000' },
      browser: {
        instances: [instances[0]],
      },
    },
  )

  expect(stderr).not.toContain('Unknown event')
  expect(exitCode).toBe(0)
  expect(testTree()).toMatchInlineSnapshot(`
    {
      "popup.test.ts": {
        "clicking a target="_blank" anchor": "passed",
      },
      "second.test.ts": {
        "a following test file still runs cleanly": "passed",
      },
    }
  `)
})
