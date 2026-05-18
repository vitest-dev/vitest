import { join } from 'node:path'
import { expect, test } from 'vitest'

import { editFile, runInlineTests, runVitest } from '../../test-utils'

test('non default snapshot format', () => {
  expect({ foo: ['bar'] }).toMatchInlineSnapshot(`
    {
      "foo": [
        "bar",
      ],
    }
  `)
})

test('--update works for workspace project', async () => {
  // setup wrong snapshot value
  editFile(
    join(import.meta.dirname, 'fixtures/workspace/packages/space/test/__snapshots__/basic.test.ts.snap'),
    data => data.replace('`1`', '`2`'),
  )

  // run with --update
  const { stdout, exitCode } = await runVitest({
    update: true,
    root: join(import.meta.dirname, 'fixtures/workspace'),
  })
  expect.soft(stdout).include('Snapshots  1 updated')
  expect.soft(exitCode).toBe(0)
})

test('test.fails fails snapshot', async () => {
  const result = await runInlineTests({
    'basic.test.ts': `
import { expect, test } from 'vitest'

test.fails('file', () => {
  expect('a').toMatchSnapshot()
})

test.fails('inline', () => {
  expect('b').toMatchInlineSnapshot()
})

test.fails('soft', () => {
  expect.soft('c').toMatchSnapshot()
  expect.soft('d').toMatchInlineSnapshot()
})
`,
  })
  expect(result.stderr).toMatchInlineSnapshot(`
    "
    ⎯⎯⎯⎯⎯⎯⎯ Failed Tests 3 ⎯⎯⎯⎯⎯⎯⎯

     FAIL  basic.test.ts > file
    TestSyntaxError: 'toMatchSnapshot' cannot be used with 'test.fails'
     ❯ basic.test.ts:5:15
          3|
          4| test.fails('file', () => {
          5|   expect('a').toMatchSnapshot()
           |               ^
          6| })
          7|

    ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/4]⎯

     FAIL  basic.test.ts > inline
    TestSyntaxError: 'toMatchInlineSnapshot' cannot be used with 'test.fails'
     ❯ basic.test.ts:9:15
          7|
          8| test.fails('inline', () => {
          9|   expect('b').toMatchInlineSnapshot()
           |               ^
         10| })
         11|

    ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/4]⎯

     FAIL  basic.test.ts > soft
    TestSyntaxError: 'toMatchSnapshot' cannot be used with 'test.fails'
     ❯ basic.test.ts:13:20
         11|
         12| test.fails('soft', () => {
         13|   expect.soft('c').toMatchSnapshot()
           |                    ^
         14|   expect.soft('d').toMatchInlineSnapshot()
         15| })

    ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[3/4]⎯

     FAIL  basic.test.ts > soft
    TestSyntaxError: 'toMatchInlineSnapshot' cannot be used with 'test.fails'
     ❯ basic.test.ts:14:20
         12| test.fails('soft', () => {
         13|   expect.soft('c').toMatchSnapshot()
         14|   expect.soft('d').toMatchInlineSnapshot()
           |                    ^
         15| })
         16|

    ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[4/4]⎯

    "
  `)
  expect(result.errorTree()).toMatchInlineSnapshot(`
    {
      "basic.test.ts": {
        "file": [
          "'toMatchSnapshot' cannot be used with 'test.fails'",
        ],
        "inline": [
          "'toMatchInlineSnapshot' cannot be used with 'test.fails'",
        ],
        "soft": [
          "'toMatchSnapshot' cannot be used with 'test.fails'",
          "'toMatchInlineSnapshot' cannot be used with 'test.fails'",
        ],
      },
    }
  `)
})
