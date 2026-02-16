import { resolve } from 'pathe'
import { expect, it } from 'vitest'
import { runVitest } from '../../test-utils'

it('assertion helper', async () => {
  const { stderr, errorTree } = await runVitest({
    root: resolve(import.meta.dirname, '../fixtures/assertion-helper'),
    printConsoleTrace: true,
  })
  expect(stderr).toMatchInlineSnapshot(`
    "stderr | basic.test.ts > helper with logs
    [test-myHelperWithLogs]
     ❯ basic.test.ts:105:3


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

     ❯ basic.test.ts:46:3
         44|
         45| test("nested", () => {
         46|   outerHelper("nested", "x");
           |   ^
         47| });
         48|

    ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[5/9]⎯

     FAIL  basic.test.ts > multiple soft
    AssertionError: expected 'first' to deeply equal 'x'

    Expected: "x"
    Received: "first"

     ❯ basic.test.ts:77:3
         75| // Multiple soft errors in one test
         76| test("multiple soft", () => {
         77|   myEqualSoft("first", "x");
           |   ^
         78|   myEqualSoft("second", "y");
         79| });

    ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[6/9]⎯

     FAIL  basic.test.ts > multiple soft
    AssertionError: expected 'second' to deeply equal 'y'

    Expected: "y"
    Received: "second"

     ❯ basic.test.ts:78:3
         76| test("multiple soft", () => {
         77|   myEqualSoft("first", "x");
         78|   myEqualSoft("second", "y");
           |   ^
         79| });
         80|

    ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[7/9]⎯

     FAIL  basic.test.ts > custom error
    Error: custom error from helper
     ❯ basic.test.ts:87:3
         85|
         86| test("custom error", () => {
         87|   throwCustom();
           |   ^
         88| });
         89|

    ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[8/9]⎯

     FAIL  basic.test.ts > non-helper wrapper
    AssertionError: expected 'wrapper' to deeply equal 'x'

    Expected: "x"
    Received: "wrapper"

     ❯ assertEqualValues basic.test.ts:92:3
         90| // non-helper wrapper calling a helper: stack should include the wrapp…
         91| function assertEqualValues(a: any, b: any) {
         92|   myEqual(a, b);
           |   ^
         93| }
         94|
     ❯ basic.test.ts:96:3

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
        "helper with logs": "passed",
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
