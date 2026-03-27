import { expect, test } from 'vitest'
import { runInlineTests } from '../../test-utils'

// JestExtendError's internal context property shouldn't show up as "Serialized Error"
test('expect.extend error message', async () => {
  const result = await runInlineTests({
    './basic.test.js': `
import { expect, test } from 'vitest';

expect.extend({
  toMyEqual(actual, expected) {
    const pass = actual === expected;
    return { pass, message: () => 'my matcher failed', actual, expected };
  },
});

test('fail', () => {
  expect(123).toMyEqual(456);
});
`,
  }, {
    reporters: 'verbose',
  })
  expect(result.stderr).toMatchInlineSnapshot(`
    "
    ⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

     FAIL  basic.test.js > fail
    Error: my matcher failed

    - Expected
    + Received

    - 456
    + 123

     ❯ basic.test.js:12:15
         10|
         11| test('fail', () => {
         12|   expect(123).toMyEqual(456);
           |               ^
         13| });
         14|

    ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯
    Serialized Error: { __vitest_error_context__: { assertionName: 'toMyEqual', meta: undefined } }
    ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯

    "
  `)
  expect(result.testTree()).toMatchInlineSnapshot(`
    {
      "basic.test.js": {
        "fail": "failed",
      },
    }
  `)
})
