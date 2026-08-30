import { expect, test } from 'vitest'
import { instances, runBrowserTests } from './utils'

test('task timeouts wait for pending actions', async () => {
  const { errorTree, stderr } = await runBrowserTests({
    root: './fixtures/timeout-actions',
    project: [instances[0].browser],
  })

  expect(errorTree()).toMatchInlineSnapshot(`
    {
      "actions.test.ts": {
        "does not wait for an action due after the test": [
          "Test timed out in 500ms.
    If this is a long-running test, pass a timeout value as the last argument or configure it globally with "testTimeout".",
        ],
        "names the pending action when it does not report back": [
          "Test timed out in 500ms while waiting for screenshot.
    If this is a long-running test, pass a timeout value as the last argument or configure it globally with "testTimeout".",
        ],
        "reports the action error when it arrives inside the grace": [
          "slow screenshot after 200ms",
        ],
      },
    }
  `)

  // the timeout error points at the pending action, not at the test
  const report = stderr.split('\n')
  const start = report.findIndex(line => line.includes('names the pending action when it does not report back'))
  const end = report.findIndex((line, index) => index > start && line.startsWith('⎯'))
  expect(report.slice(start, end).join('\n')).toMatchInlineSnapshot(`
    " FAIL  |chromium| actions.test.ts > names the pending action when it does not report back
    Error: Test timed out in 500ms while waiting for screenshot.
    If this is a long-running test, pass a timeout value as the last argument or configure it globally with "testTimeout".
     ❯ actions.test.ts:9:14
          7|
          8| it('names the pending action when it does not report back', async () =…
          9|   await page.screenshot({ path: 'delay-2000.png' })
           |              ^
         10| }, 500)
         11|
    "
  `)
})
