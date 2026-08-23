import { expect, test } from 'vitest'
import { instances, provider, runBrowserTests, runInlineBrowserTests } from './utils'

test('fails gracefully when browser crashes', async () => {
  const { stderr } = await runBrowserTests({
    root: './fixtures/browser-crash',
    reporters: [['verbose', { isTTY: false }]],
  })

  // the crash is reported over CDP and as a websocket disconnect;
  // whichever arrives first fails the run
  expect(stderr).toMatch(
    /page crashed while running tests|Browser connection was closed while running tests/,
  )
})

// crashing the browser after `cancelCurrentRun` rejects the pending
// `createTesters` call while `isCancelling` is set, so the run must
// exit gracefully instead of reporting an unhandled error
test.runIf(provider.name === 'playwright' && instances[0].browser !== 'webkit')(
  'exits gracefully when the browser connection is closed while cancelling',
  async () => {
    const crashUrl = instances[0].browser === 'firefox' ? 'about:crashcontent' : 'chrome://crash'
    const { ctx, stderr } = await runInlineBrowserTests(
      {
        'cancel.test.ts': `
          import { commands } from 'vitest/browser'
          import { test } from 'vitest'

          test('cancels the run and crashes the browser', async () => {
            await commands.cancelAndCrash()
          })
        `,
      },
      {
        browser: {
          instances: [instances[0]],
          commands: {
            async cancelAndCrash(context) {
              context.project.vitest.cancelCurrentRun('keyboard-input')
              await context.page.goto(crashUrl, { timeout: 1000 }).catch(() => {})
            },
          },
        },
      },
    )

    expect(ctx!.state.getUnhandledErrors()).toEqual([])
    expect(stderr).not.toContain('Failed to run the test')
  },
)

test('vitest bails out when the iframe is no longer accessible', async () => {
  const { stderr } = await runBrowserTests({
    root: './fixtures/broken-iframe',
    reporters: [['verbose', { isTTY: false }]],
  }, [], {}, { fails: true })
  expect(stderr).toContain(
    'Cannot connect to the iframe. Did you change the location or submitted a form? If so, don\'t forget to call `event.preventDefault()` to avoid reloading the page.',
  )
  expect(stderr).toContain('Received URL: http://')
  expect(stderr).toContain('Expected: http://')
})
