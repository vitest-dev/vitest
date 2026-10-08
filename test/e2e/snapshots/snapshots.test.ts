import { join } from 'node:path'
import { expect, test } from 'vitest'
import { editFile, runInlineTests, runVitest } from '../../test-utils'

test('--update works for workspace project', async () => {
  // setup wrong snapshot value
  editFile(
    join(
      import.meta.dirname,
      'fixtures/workspace/packages/space/test/__snapshots__/basic.test.ts.snap',
    ),
    (data) => data.replace('`1`', '`2`'),
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

test('test names with line endings match their snapshots on the next run', async () => {
  const result = await runInlineTests(
    {
      'basic.test.ts': `
import { expect, test } from 'vitest'

test.for(['a\\nb', 'a\\r\\nb', 'a\\rb'])('%s', (input) => {
  expect(input.length).toMatchSnapshot()
})
`,
    },
    { update: 'new' },
  )
  expect(result.stderr).toBe('')
  expect(result.fs.readFile('__snapshots__/basic.test.ts.snap')).toMatchInlineSnapshot(`
    "// Vitest Snapshot v1, https://vitest.dev/guide/snapshot.html

    exports[\`a
    b 1\`] = \`3\`;

    exports[\`a\\r
    b 1\`] = \`4\`;

    exports[\`a\\rb 1\`] = \`3\`;
    "
  `)

  const rerun = await runVitest({ root: result.root, update: 'none' })
  expect(rerun.stderr).toBe('')
  expect(rerun.ctx?.snapshot.summary).toMatchInlineSnapshot(`
    {
      "added": 0,
      "didUpdate": false,
      "failure": false,
      "filesAdded": 0,
      "filesRemoved": 0,
      "filesRemovedList": [],
      "filesUnmatched": 0,
      "filesUpdated": 0,
      "matched": 3,
      "total": 3,
      "unchecked": 0,
      "uncheckedKeysByFile": [],
      "unmatched": 0,
      "updated": 0,
    }
  `)
})
