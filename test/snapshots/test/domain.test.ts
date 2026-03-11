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
        "literal": "passed",
        "mixed": "passed",
        "regex": "passed",
      },
    }
  `)
  let snap = readFileSync(snapshotFile, 'utf-8')
  expect(snap).toMatchInlineSnapshot(`
    "// Vitest Snapshot v1, https://vitest.dev/guide/snapshot.html

    exports[\`literal 1\`] = \`custom:hello 123\`;

    exports[\`mixed 1\`] = \`custom:foo 789\`;

    exports[\`mixed 2\`] = \`custom:bar 012\`;

    exports[\`regex 1\`] = \`custom:world 456\`;
    "
  `)

  // 2. hand-edit snapshot to introduce regex patterns
  editFile(snapshotFile, s => s
    .replace('custom:world 456', 'custom:/world \\d+/')
    .replace('custom:foo 789', 'custom:/foo \\d+/')
  )

  // 3. re-run without update — regex patterns match, snapshot unchanged
  const snapWithRegex = readFileSync(snapshotFile, 'utf-8')
  result = await runVitest({ root })
  expect(result.stderr).toMatchInlineSnapshot(`
    "
    ⎯⎯⎯⎯⎯⎯⎯ Failed Tests 2 ⎯⎯⎯⎯⎯⎯⎯

     FAIL  basic.test.ts > regex
    Error: Snapshot \`regex 1\` mismatched

    Expected: "custom:/world d+/"
    Received: "custom:world 456"

     ❯ basic.test.ts:40:23
         38|
         39| test('regex', () => {
         40|   expect('world 456').toMatchDomainSnapshot('test-domain')
           |                       ^
         41| })
         42|

    ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/2]⎯

     FAIL  basic.test.ts > mixed
    Error: Snapshot \`mixed 1\` mismatched

    Expected: "custom:/foo d+/"
    Received: "custom:foo 789"

     ❯ basic.test.ts:44:21
         42|
         43| test('mixed', () => {
         44|   expect('foo 789').toMatchDomainSnapshot('test-domain')
           |                     ^
         45|   expect('bar 012').toMatchDomainSnapshot('test-domain')
         46| })

    ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/2]⎯

    "
  `)
  expect(result.errorTree()).toMatchInlineSnapshot(`
    Object {
      "basic.test.ts": Object {
        "literal": "passed",
        "mixed": Array [
          "Snapshot \`mixed 1\` mismatched",
        ],
        "regex": Array [
          "Snapshot \`regex 1\` mismatched",
        ],
      },
    }
  `)
  expect(readFileSync(snapshotFile, 'utf-8')).toMatchInlineSnapshot(`
    "// Vitest Snapshot v1, https://vitest.dev/guide/snapshot.html

    exports[\`literal 1\`] = \`custom:hello 123\`;

    exports[\`mixed 1\`] = \`custom:/foo d+/\`;

    exports[\`mixed 2\`] = \`custom:bar 012\`;

    exports[\`regex 1\`] = \`custom:/world d+/\`;
    "
  `)

  // 4. edit test: change values so regex still matches some, not others
  //    - 'world 456' -> 'world 999' (regex /world \d+/ still matches)
  //    - 'foo 789' -> 'foo 999' (regex /foo \d+/ still matches)
  //    - 'bar 012' -> 'baz 345' (literal 'bar 012' does NOT match)
  editFile(testFile, s => s
    .replace(`'world 456'`, `'world 999'`)
    .replace(`'foo 789'`, `'foo 999'`)
    .replace(`'bar 012'`, `'baz 345'`)
  )

  // 5. run without update — 'bar 012' mismatch causes failure
  result = await runVitest({ root })
  expect(result.stderr).toMatchInlineSnapshot(`
    "
    ⎯⎯⎯⎯⎯⎯⎯ Failed Tests 2 ⎯⎯⎯⎯⎯⎯⎯

     FAIL  basic.test.ts > regex
    Error: Snapshot \`regex 1\` mismatched

    Expected: "custom:/world d+/"
    Received: "custom:world 999"

     ❯ basic.test.ts:40:23
         38|
         39| test('regex', () => {
         40|   expect('world 999').toMatchDomainSnapshot('test-domain')
           |                       ^
         41| })
         42|

    ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/2]⎯

     FAIL  basic.test.ts > mixed
    Error: Snapshot \`mixed 1\` mismatched

    Expected: "custom:/foo d+/"
    Received: "custom:foo 999"

     ❯ basic.test.ts:44:21
         42|
         43| test('mixed', () => {
         44|   expect('foo 999').toMatchDomainSnapshot('test-domain')
           |                     ^
         45|   expect('baz 345').toMatchDomainSnapshot('test-domain')
         46| })

    ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/2]⎯

    "
  `)
  expect(result.errorTree()).toMatchInlineSnapshot(`
    Object {
      "basic.test.ts": Object {
        "literal": "passed",
        "mixed": Array [
          "Snapshot \`mixed 1\` mismatched",
        ],
        "regex": Array [
          "Snapshot \`regex 1\` mismatched",
        ],
      },
    }
  `)

  // 6. run with update — should preserve regex where it matched,
  //    overwrite literal where it didn't
  result = await runVitest({ root, update: 'all' })
  expect(result.stderr).toMatchInlineSnapshot(`""`)
  expect(result.errorTree()).toMatchInlineSnapshot(`
    Object {
      "basic.test.ts": Object {
        "literal": "passed",
        "mixed": "passed",
        "regex": "passed",
      },
    }
  `)
  snap = readFileSync(snapshotFile, 'utf-8')
  expect(snap).toMatchInlineSnapshot(`
    "// Vitest Snapshot v1, https://vitest.dev/guide/snapshot.html

    exports[\`literal 1\`] = \`custom:hello 123\`;

    exports[\`mixed 1\`] = \`custom:foo 999\`;

    exports[\`mixed 2\`] = \`custom:baz 345\`;

    exports[\`regex 1\`] = \`custom:world 999\`;
    "
  `)
})
