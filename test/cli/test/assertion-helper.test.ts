import { resolve } from 'pathe'
import { expect, it } from 'vitest'
import { runVitest } from '../../test-utils'

it('assertion helper', async () => {
  const { stderr, errorTree } = await runVitest({
    root: resolve(import.meta.dirname, '../fixtures/assertion-helper'),
  })
  expect(stderr).toMatchInlineSnapshot(`
    "
    ⎯⎯⎯⎯⎯⎯⎯ Failed Tests 8 ⎯⎯⎯⎯⎯⎯⎯

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

    ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/9]⎯

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

    ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/9]⎯

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

    ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[3/9]⎯

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

    ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[4/9]⎯

     FAIL  basic.test.ts > nested
    AssertionError: expected 'nested' to deeply equal 'x'

    Expected: "x"
    Received: "nested"

     ❯ basic.test.ts:48:3
         46|
         47| test("nested", () => {
         48|   outerHelper("nested", "x");
           |   ^
         49| });
         50|

    ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[5/9]⎯

     FAIL  basic.test.ts > multiple soft
    AssertionError: expected 'first' to deeply equal 'x'

    Expected: "x"
    Received: "first"

     ❯ basic.test.ts:79:3
         77| // Multiple soft errors in one test
         78| test("multiple soft", () => {
         79|   myEqualSoft("first", "x");
           |   ^
         80|   myEqualSoft("second", "y");
         81| });

    ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[6/9]⎯

     FAIL  basic.test.ts > multiple soft
    AssertionError: expected 'second' to deeply equal 'y'

    Expected: "y"
    Received: "second"

     ❯ basic.test.ts:80:3
         78| test("multiple soft", () => {
         79|   myEqualSoft("first", "x");
         80|   myEqualSoft("second", "y");
           |   ^
         81| });
         82|

    ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[7/9]⎯

     FAIL  basic.test.ts > custom error
    Error: custom error from helper
     ❯ basic.test.ts:89:3
         87|
         88| test("custom error", () => {
         89|   throwCustom();
           |   ^
         90| });
         91|

    ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[8/9]⎯

     FAIL  basic.test.ts > non-helper wrapper
    AssertionError: expected 'wrapper' to deeply equal 'x'

    Expected: "x"
    Received: "wrapper"

     ❯ assertEqualValues basic.test.ts:94:3
         92| // non-helper wrapper calling a helper: stack should include the wrapp…
         93| function assertEqualValues(a: any, b: any) {
         94|   myEqual(a, b);
           |   ^
         95| }
         96|
     ❯ basic.test.ts:98:3

    ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[9/9]⎯

    "
  `)
  expect(errorTree()).toMatchInlineSnapshot(`
    {
      "basic.test.ts": {
        "async": [
          "expected 'async' to deeply equal 'x'",
        ],
        "custom error": [
          "custom error from helper",
        ],
        "multiple soft": [
          "expected 'first' to deeply equal 'x'",
          "expected 'second' to deeply equal 'y'",
        ],
        "nested": [
          "expected 'nested' to deeply equal 'x'",
        ],
        "non-helper wrapper": [
          "expected 'wrapper' to deeply equal 'x'",
        ],
        "pass async": "passed",
        "pass sync": "passed",
        "return async": "passed",
        "return sync": "passed",
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
