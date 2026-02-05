import { expect, test } from 'vitest'
import { runBrowserTests } from './utils'

test('vi.helper hides internal stack traces', async () => {
  const { stderr, errorTree } = await runBrowserTests({
    root: './fixtures/assertion-helper',
  })

  expect(stderr).toMatchInlineSnapshot(`
    "
    ⎯⎯⎯⎯⎯⎯⎯ Failed Tests 6 ⎯⎯⎯⎯⎯⎯⎯

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

    ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/6]⎯

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

    ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/6]⎯

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

    ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[3/6]⎯

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

    ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[4/6]⎯

     FAIL  |chromium| basic.test.ts > manual
    AssertionError: expected 'manual' to deeply equal 'no'

    Failure screenshot:
      - fixtures/assertion-helper/__screenshots__/basic.test.ts/manual-1.png

    Expected: "no"
    Received: "manual"

     ❯ basic.test.ts:43:12
         41| 
         42| const manual = helper((a: any, b: any) => {
         43|   expect(a).toEqual(b)
           |            ^
         44| })
         45| 
     ❯ __MANUAL_HELPER__ basic.test.ts:61:19
     ❯ basic.test.ts:52:2

    ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[5/6]⎯

     FAIL  |chromium| basic.test.ts > manual async
    AssertionError: expected 'manual async' to deeply equal 'no'

    Failure screenshot:
      - fixtures/assertion-helper/__screenshots__/basic.test.ts/manual-async-1.png

    Expected: "no"
    Received: "manual async"

     ❯ basic.test.ts:48:12
         46| const manualAsync = helper(async (a: any, b: any) => {
         47|   await new Promise(r => setTimeout(r, 1))
         48|   expect(a).toEqual(b)
           |            ^
         49| })
         50| 
     ❯ __MANUAL_HELPER_ASYNC__ basic.test.ts:64:15
     ❯ basic.test.ts:56:2

    ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[6/6]⎯

    "
  `)
  expect(errorTree()).toMatchInlineSnapshot(`
    {
      "basic.test.ts": {
        "async": [
          "expected 'left' to deeply equal 'right'",
        ],
        "manual": [
          "expected 'manual' to deeply equal 'no'",
        ],
        "manual async": [
          "expected 'manual async' to deeply equal 'no'",
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
