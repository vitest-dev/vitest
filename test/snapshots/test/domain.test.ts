import fs, { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, test } from 'vitest'
import { editFile, runVitest } from '../../test-utils'

test('domain snapshot', async () => {
  const root = join(import.meta.dirname, 'fixtures/domain')
  const testFile = join(root, 'basic.test.ts')
  const snapshotFile = join(root, '__snapshots__/basic.test.ts.snap')

  // clean slate
  fs.rmSync(join(root, '__snapshots__'), { recursive: true, force: true })

  // create snapshots from scratch — literal rendered values
  let result = await runVitest({ root, update: 'new' })
  expect(result.stderr).toMatchInlineSnapshot(`""`)
  expect(result.errorTree()).toMatchInlineSnapshot(`
    Object {
      "basic.test.ts": Object {
        "all literal": "passed",
        "with regex": "passed",
      },
    }
  `)
  expect(readFileSync(snapshotFile, 'utf-8')).toMatchInlineSnapshot(`
    "// Vitest Snapshot v1, https://vitest.dev/guide/snapshot.html

    exports[\`all literal 1\`] = \`
    name=alice
    age=30
    \`;

    exports[\`with regex 1\`] = \`
    name=bob
    age=24
    score=999
    status=active
    \`;
    "
  `)

  // hand-edit snapshot
  editFile(snapshotFile, s => s
    // match any numbers match for score
    .replace('score=999', 'score=/\\\\d+/')
    .replace('age=24\n', ''))

  // re-run without update
  result = await runVitest({ root, update: 'none' })
  expect(result.stderr).toMatchInlineSnapshot(`""`)
  expect(result.errorTree()).toMatchInlineSnapshot(`
    Object {
      "basic.test.ts": Object {
        "all literal": "passed",
        "with regex": "passed",
      },
    }
  `)
  expect(readFileSync(snapshotFile, 'utf-8')).toMatchInlineSnapshot(`
    "// Vitest Snapshot v1, https://vitest.dev/guide/snapshot.html

    exports[\`all literal 1\`] = \`
    name=alice
    age=30
    \`;

    exports[\`with regex 1\`] = \`
    name=bob
    score=/\\\\d+/
    status=active
    \`;
    "
  `)

  // edit test
  editFile(testFile, s => s
    .replace(`score: '999'`, `score: '42'`)
    .replace(`status: 'active'`, `status: 'inactive'`))

  // run without update
  // (note that `age` and `score` is not in diff)
  result = await runVitest({ root, update: 'none' })
  expect(result.stderr).toMatchInlineSnapshot(`
    "
    ⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

     FAIL  basic.test.ts > with regex
    Error: Snapshot \`with regex 1\` mismatched

    - Expected
    + Received

      name=bob
      score=/\\d+/
    - status=active
    + status=inactive

     ❯ basic.test.ts:9:71
          7|
          8| test('with regex', () => {
          9|   expect({ name: 'bob', age: '24', score: '42', status: 'inactive' }).…
           |                                                                       ^
         10| })
         11|

    ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯

    "
  `)
  expect(result.errorTree()).toMatchInlineSnapshot(`
    Object {
      "basic.test.ts": Object {
        "all literal": "passed",
        "with regex": Array [
          "Snapshot \`with regex 1\` mismatched",
        ],
      },
    }
  `)

  // run with update — should preserve score regex (matched),
  //    overwrite status with literal (didn't match)
  result = await runVitest({ root, update: 'all' })
  expect(result.stderr).toMatchInlineSnapshot(`""`)
  expect(result.errorTree()).toMatchInlineSnapshot(`
    Object {
      "basic.test.ts": Object {
        "all literal": "passed",
        "with regex": "passed",
      },
    }
  `)
  // NOTE
  // score regex matched '42' -> preserved as /\d+/
  // status literal 'active' != 'inactive' -> overwritten with literal
  expect(readFileSync(snapshotFile, 'utf-8')).toMatchInlineSnapshot(`
    "// Vitest Snapshot v1, https://vitest.dev/guide/snapshot.html

    exports[\`all literal 1\`] = \`
    name=alice
    age=30
    \`;

    exports[\`with regex 1\`] = \`
    name=bob
    score=/\\\\d+/
    status=inactive
    \`;
    "
  `)
})

test('domain parseExpected error', async () => {
  const root = join(import.meta.dirname, 'fixtures/domain-error')
  const result = await runVitest({ root, update: 'none' })
  expect(result.stderr).toMatchInlineSnapshot(`
    "
    ⎯⎯⎯⎯⎯⎯⎯ Failed Tests 2 ⎯⎯⎯⎯⎯⎯⎯

     FAIL  basic.test.ts > file
    Error: Invalid KV Format: 'file-broken'
     ❯ ../domain/basic.ts:34:15
         32|       const eq = line.indexOf('=')
         33|       if (eq === -1) {
         34|         throw new Error(\`Invalid KV Format: '\${line}'\`)
           |               ^
         35|       }
         36|       const key = line.slice(0, eq)
     ❯ Object.parseExpected ../domain/basic.ts:31:46
     ❯ basic.test.ts:7:40

    ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/2]⎯

     FAIL  basic.test.ts > inline
    Error: Invalid KV Format: 'inine-broken'
     ❯ ../domain/basic.ts:34:15
         32|       const eq = line.indexOf('=')
         33|       if (eq === -1) {
         34|         throw new Error(\`Invalid KV Format: '\${line}'\`)
           |               ^
         35|       }
         36|       const key = line.slice(0, eq)
     ❯ Object.parseExpected ../domain/basic.ts:31:46
     ❯ basic.test.ts:11:40

    ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/2]⎯

    "
  `)
  expect(result.errorTree()).toMatchInlineSnapshot(`
    Object {
      "basic.test.ts": Object {
        "file": Array [
          "Invalid KV Format: 'file-broken'",
        ],
        "inline": Array [
          "Invalid KV Format: 'inine-broken'",
        ],
      },
    }
  `)
})
