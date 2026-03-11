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

  // 1. create snapshots from scratch — literal rendered values
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
    score=999
    status=active
    \`;
    "
  `)

  // 2. hand-edit snapshot to introduce regex patterns for "with regex" test
  //    score=999 -> score=/\\d+/   (regex, should match any number)
  //    status stays literal
  editFile(snapshotFile, s => s
    .replace('score=999', 'score=/\\\\d+/'))

  // 3. re-run without update — regex pattern matches, all pass, snapshot unchanged
  result = await runVitest({ root })
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

  // 4. edit test: change values within "with regex"
  //    - score: '999' -> '42'  (regex /\d+/ still matches)
  //    - status: 'active' -> 'inactive'  (literal does NOT match)
  editFile(testFile, s => s
    .replace(`score: '999'`, `score: '42'`)
    .replace(`status: 'active'`, `status: 'inactive'`))

  // 5. run without update — status mismatch causes failure
  // NOTE: score=/\\d+/ vs score='42' doesn't show up as diff.
  result = await runVitest({ root })
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

     ❯ basic.test.ts:116:60
        114|
        115| test('with regex', () => {
        116|   expect({ name: 'bob', score: '42', status: 'inactive' }).toMatchDoma…
           |                                                            ^
        117| })
        118|

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

  // 6. run with update — should preserve score regex (matched),
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
