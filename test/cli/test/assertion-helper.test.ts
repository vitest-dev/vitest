import { resolve } from 'pathe'
import { expect, it } from 'vitest'
import { runVitest } from '../../test-utils'

it('assertion helper', async () => {
  const { stderr, errorTree } = await runVitest({
    root: resolve(import.meta.dirname, '../fixtures/assertion-helper'),
  })
  expect(stderr).toMatchInlineSnapshot(`
    "
    ⎯⎯⎯⎯⎯⎯⎯ Failed Tests 4 ⎯⎯⎯⎯⎯⎯⎯

     FAIL  basic.test.ts > sync
    AssertionError: expected 'sync' to deeply equal 'x'

    Expected: "x"
    Received: "sync"

     ❯ basic.test.ts:22:3
         20|
         21| test("sync", () => {
         22|   myEqual("sync", "x");
           |   ^
         23| });
         24|

    ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/4]⎯

     FAIL  basic.test.ts > async
    AssertionError: expected 'async' to deeply equal 'x'

    Expected: "x"
    Received: "async"

     ❯ basic.test.ts:26:3
         24|
         25| test("async", async () => {
         26|   await myEqualAsync("async", "x");
           |   ^
         27| });
         28|

    ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/4]⎯

     FAIL  basic.test.ts > soft
    AssertionError: expected 'soft' to deeply equal 'x'

    Expected: "x"
    Received: "soft"

     ❯ basic.test.ts:30:3
         28|
         29| test("soft", () => {
         30|   myEqualSoft("soft", "x");
           |   ^
         31| });
         32|

    ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[3/4]⎯

     FAIL  basic.test.ts > soft async
    AssertionError: expected 'soft async' to deeply equal 'x'

    Expected: "x"
    Received: "soft async"

     ❯ basic.test.ts:34:3
         32|
         33| test("soft async", async () => {
         34|   await myEqualSoftAsync("soft async", "x");
           |   ^
         35| });
         36|

    ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[4/4]⎯

    "
  `)
  expect(errorTree()).toMatchInlineSnapshot(`
    {
      "basic.test.ts": {
        "async": [
          "expected 'async' to deeply equal 'x'",
        ],
        "soft": [
          "expected 'soft' to deeply equal 'x'",
        ],
        "soft async": [
          "expected 'soft async' to deeply equal 'x'",
        ],
        "sync": [
          "expected 'sync' to deeply equal 'x'",
        ],
      },
    }
  `)
})
