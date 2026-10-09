import { expect, test } from 'vitest'
import { instances, runInlineBrowserTests } from './utils'

test('fails instead of hanging when the tester iframe never loads', async () => {
  const { ctx, fs, testTree } = await runInlineBrowserTests(
    {
      'basic.test.ts': `
        import { test } from 'vitest'
        test('never runs', () => {})
      `,
      'delayed-load.html': `
        <!DOCTYPE html>
        <html><head><script src="/delayed-load.js"></script></head><body></body></html>
      `,
    },
    {
      env: { VITEST_BROWSER_IFRAME_TIMEOUT: '1000' },
      browser: {
        instances: [instances[0]],
        testerHtmlPath: './delayed-load.html',
      },
      $viteConfig: {
        plugins: [
          {
            name: 'delay-tester-load',
            configureServer(server) {
              server.middlewares.use((req, res, next) => {
                if (req.url !== '/delayed-load.js') {
                  return next()
                }
                const timer = setTimeout(() => {
                  res.setHeader('Content-Type', 'text/javascript')
                  res.end('')
                }, 5000)
                res.on('close', () => clearTimeout(timer))
              })
            },
          },
        ],
      },
    },
  )

  expect(
    ctx!.state.getUnhandledErrors().map((error: any) => ({
      message: error.message.replace(fs.root, '<root>'),
      cause: error.cause?.message.replace(fs.root, '<root>'),
    })),
  ).toMatchInlineSnapshot(`
    [
      {
        "cause": "The iframe "<root>/basic.test.ts" did not load within 1000ms. The browser might be under heavy load or the iframe failed to start.",
        "message": "Failed to run the test <root>/basic.test.ts.",
      },
    ]
  `)
  expect(testTree()).toMatchInlineSnapshot(`{}`)
})

test(
  'fails instead of hanging after acknowledging a stalled test file',
  { timeout: 20000 },
  async () => {
    const { ctx, fs, testTree } = await runInlineBrowserTests(
      {
        'stalled.test.ts': `await new Promise(() => {})`,
        'passing.test.ts': `
        import { test } from 'vitest'
        test('still runs', () => {})
      `,
      },
      {
        env: { VITEST_BROWSER_IFRAME_TIMEOUT: '1000' },
        browser: { instances: [instances[0]] },
      },
    )

    expect(
      ctx!.state.getUnhandledErrors().map((error: any) => ({
        message: error.message.replace(fs.root, '<root>'),
        cause: error.cause?.message.replace(fs.root, '<root>'),
      })),
    ).toMatchInlineSnapshot(`
    [
      {
        "cause": "The iframe "<root>/stalled.test.ts" did not respond to the "execute" message within 10000ms after acknowledging it. The tester might have stalled or crashed while handling the message.",
        "message": "Failed to run the test <root>/stalled.test.ts.",
      },
    ]
  `)
    expect(testTree()).toMatchInlineSnapshot(`
    {
      "passing.test.ts": {
        "still runs": "passed",
      },
      "stalled.test.ts": {},
    }
  `)
  },
)

test('allows acknowledged test work to exceed the acknowledgement timeout', async () => {
  const { stderr, testTree } = await runInlineBrowserTests(
    {
      'basic.test.ts': `
        import { test } from 'vitest'
        test('takes longer than the acknowledgement timeout', async () => {
          await new Promise(resolve => setTimeout(resolve, 2000))
        })
      `,
    },
    {
      env: { VITEST_BROWSER_IFRAME_TIMEOUT: '1000' },
      browser: { instances: [instances[0]] },
    },
  )

  expect(stderr).toBe('')
  expect(testTree()).toMatchInlineSnapshot(`
    {
      "basic.test.ts": {
        "takes longer than the acknowledgement timeout": "passed",
      },
    }
  `)
})

test(
  'prepare waits until the tester can receive browser channel events',
  { timeout: 5000 },
  async () => {
    const { stderr, testTree } = await runInlineBrowserTests(
      {
        'basic.test.ts': `
        import { expect, test } from 'vitest'

        test('runs in the browser', () => {
          expect(1).toBe(1)
        })
      `,
        'delayed-tester.html': `
        <!DOCTYPE html>
        <html lang="en">
          <head>
            <meta charset="UTF-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1.0" />
            <title>Delayed Tester</title>
            <script>
              const addEventListener = BroadcastChannel.prototype.addEventListener
              const postMessage = BroadcastChannel.prototype.postMessage
              BroadcastChannel.prototype.addEventListener = function(type, listener, options) {
                if (type === 'message') {
                  setTimeout(() => addEventListener.call(this, type, listener, options), 100)
                  return
                }
                return addEventListener.call(this, type, listener, options)
              }
              BroadcastChannel.prototype.postMessage = function(message) {
                if (message && message.event === 'ready') {
                  setTimeout(() => postMessage.call(this, message), 150)
                  return
                }
                return postMessage.call(this, message)
              }
            </script>
          </head>
          <body></body>
        </html>
      `,
      },
      {
        browser: {
          instances: [instances[0]],
          testerHtmlPath: './delayed-tester.html',
        },
      },
    )

    expect(stderr).toBe('')
    expect(testTree()).toMatchInlineSnapshot(`
    {
      "basic.test.ts": {
        "runs in the browser": "passed",
      },
    }
  `)
  },
)

test(
  'fails instead of hanging when the tester never becomes ready',
  { timeout: 20000 },
  async () => {
    const { stderr, fs, testTree } = await runInlineBrowserTests(
      {
        'basic.test.ts': `
        import { expect, test } from 'vitest'

        test('never runs', () => {
          expect(1).toBe(1)
        })
      `,
        'silent-tester.html': `
        <!DOCTYPE html>
        <html lang="en">
          <head>
            <meta charset="UTF-8" />
            <script>
              // simulate a tester that loads but never reports readiness
              const postMessage = BroadcastChannel.prototype.postMessage
              BroadcastChannel.prototype.postMessage = function (message) {
                if (message && message.event === 'ready') {
                  return
                }
                return postMessage.call(this, message)
              }
            </script>
          </head>
          <body></body>
        </html>
      `,
      },
      {
        env: { VITEST_BROWSER_IFRAME_TIMEOUT: '2000' },
        browser: {
          instances: [instances[0]],
          testerHtmlPath: './silent-tester.html',
        },
      },
    )

    expect(stderr).toContain(`Failed to run the test ${fs.resolveFile('basic.test.ts')}`)
    expect(stderr).toContain(
      `The iframe "${fs.resolveFile('basic.test.ts')}" did not become ready within 2000ms. The tester likely failed to initialize, check the browser console for errors.`,
    )
    expect(testTree()).toMatchInlineSnapshot(`{}`)
  },
)

test(
  'fails instead of hanging when the tester stops responding to messages',
  { timeout: 20000 },
  async () => {
    const { stderr, fs, testTree } = await runInlineBrowserTests(
      {
        'basic.test.ts': `
        import { expect, test } from 'vitest'

        test('never runs', () => {
          expect(1).toBe(1)
        })
      `,
        'unresponsive-tester.html': `
        <!DOCTYPE html>
        <html lang="en">
          <head>
            <meta charset="UTF-8" />
            <script>
              // tester reports readiness but its acknowledgements and responses
              // never reach the orchestrator (e.g. it crashed mid-run)
              const postMessage = BroadcastChannel.prototype.postMessage
              BroadcastChannel.prototype.postMessage = function (message) {
                if (message && typeof message.event === 'string'
                  && (message.event.startsWith('ack:') || message.event.startsWith('response:'))) {
                  return
                }
                return postMessage.call(this, message)
              }
            </script>
          </head>
          <body></body>
        </html>
      `,
      },
      {
        env: { VITEST_BROWSER_IFRAME_TIMEOUT: '2000' },
        browser: {
          instances: [instances[0]],
          testerHtmlPath: './unresponsive-tester.html',
        },
      },
    )

    expect(stderr).toContain(`Failed to run the test ${fs.resolveFile('basic.test.ts')}`)
    expect(stderr).toContain(
      `The iframe "${fs.resolveFile('basic.test.ts')}" did not acknowledge the "prepare" message within 2000ms. The tester might have crashed, been removed, or be blocked by a long synchronous task.`,
    )
    expect(testTree()).toMatchInlineSnapshot(`{}`)
  },
)
