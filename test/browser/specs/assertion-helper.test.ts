import { expect, test } from 'vitest'
import { runBrowserTests } from './utils'

test('vi.helper hides internal stack traces', async () => {
  const { stderr, errorTree } = await runBrowserTests({
    root: './fixtures/assertion-helper',
  })

  expect(stderr).toMatchInlineSnapshot(`
    "
    ⎯⎯⎯⎯⎯⎯⎯ Failed Tests 4 ⎯⎯⎯⎯⎯⎯⎯

     FAIL  |chromium| basic.test.ts > sync
    AssertionError: expected 'left' to deeply equal 'right'

    Failure screenshot:
      - fixtures/assertion-helper/__screenshots__/basic.test.ts/sync-1.png

    Expected: "right"
    Received: "left"

     ❯ basic.test.ts:25:2
         23|
         24| test('sync', () => {
         25|   myEqual('left', 'right')
           |  ^
         26| })
         27|

    ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/4]⎯

     FAIL  |chromium| basic.test.ts > async
    AssertionError: expected 'left' to deeply equal 'right'

    Failure screenshot:
      - fixtures/assertion-helper/__screenshots__/basic.test.ts/async-1.png

    Expected: "right"
    Received: "left"

     ❯ basic.test.ts:29:2
         27|
         28| test('async', async () => {
         29|   await myEqualAsync('left', 'right')
           |  ^
         30| })
         31|

    ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/4]⎯

     FAIL  |chromium| basic.test.ts > soft
    AssertionError: expected 'left' to deeply equal 'right'

    Failure screenshot:
      - fixtures/assertion-helper/__screenshots__/basic.test.ts/soft-1.png

    Expected: "right"
    Received: "left"

     ❯ basic.test.ts:33:2
         31|
         32| test('soft', () => {
         33|   myEqualSoft('left', 'right')
           |  ^
         34| })
         35|

    ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[3/4]⎯

     FAIL  |chromium| basic.test.ts > soft async
    AssertionError: expected 'left' to deeply equal 'right'

    Failure screenshot:
      - fixtures/assertion-helper/__screenshots__/basic.test.ts/soft-async-1.png

    Expected: "right"
    Received: "left"

     ❯ basic.test.ts:37:2
         35|
         36| test('soft async', async () => {
         37|   await myEqualSoftAsync('left', 'right')
           |  ^
         38| })
         39|

    ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[4/4]⎯

    "
  `)
  expect(errorTree()).toMatchInlineSnapshot(`
    {
      "basic.test.ts": {
        "async": [
          "expected 'left' to deeply equal 'right'",
        ],
        "soft": [
          "expected 'left' to deeply equal 'right'",
        ],
        "soft async": [
          "expected 'left' to deeply equal 'right'",
        ],
        "sync": [
          "expected 'left' to deeply equal 'right'",
        ],
      },
    }
  `)
})
