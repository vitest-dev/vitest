import { expect, test } from 'vitest'
import { instances, runInlineBrowserTests } from './utils'

test('prepare waits until the tester can receive browser channel events', { timeout: 5000 }, async () => {
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
})
