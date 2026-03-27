import fs, { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, test } from 'vitest'
import { editFile, runVitest } from '../../test-utils'

const INLINE_BLOCK_RE = /\/\/ -- TEST INLINE START --\n([\s\S]*?)\/\/ -- TEST INLINE END --/g

function extractInlineBlocks(content: string): string {
  return [...content.matchAll(INLINE_BLOCK_RE)]
    .map(m => m[1].trim())
    .join('\n\n')
}

test('custom snapshot matcher', async () => {
  const root = join(import.meta.dirname, 'fixtures/custom-matcher')
  const testFile = join(root, 'basic.test.ts')
  const snapshotFile = join(root, '__snapshots__/basic.test.ts.snap')

  // remove snapshots
  fs.rmSync(join(root, '__snapshots__'), { recursive: true, force: true })
  editFile(testFile, s => s.replace(/toMatchCustomInlineSnapshot\(`[^`]*`\)/g, 'toMatchCustomInlineSnapshot()'))

  // create snapshots from scratch
  let result = await runVitest({ root, update: 'new' })
  expect(result.stderr).toMatchInlineSnapshot(`""`)
  expect(readFileSync(snapshotFile, 'utf-8')).toMatchInlineSnapshot(`
    "// Vitest Snapshot v1, https://vitest.dev/guide/snapshot.html

    exports[\`file 1\`] = \`
    Object {
      "length": 6,
      "reversed": "ahahah",
    }
    \`;

    exports[\`properties 1 1\`] = \`
    Object {
      "length": 6,
      "reversed": "opopop",
    }
    \`;

    exports[\`properties 2 1\`] = \`
    Object {
      "length": toSatisfy<[Function lessThan10]>,
      "reversed": "epepep",
    }
    \`;
    "
  `)
  expect(extractInlineBlocks(readFileSync(testFile, 'utf-8'))).toMatchInlineSnapshot(`
    "test('inline', () => {
      expect(\`hehehe\`).toMatchCustomInlineSnapshot(\`
        Object {
          "length": 6,
          "reversed": "eheheh",
        }
      \`)
    })"
  `)
  expect(result.errorTree()).toMatchInlineSnapshot(`
    Object {
      "basic.test.ts": Object {
        "file": "passed",
        "inline": "passed",
        "properties 1": "passed",
        "properties 2": "passed",
      },
    }
  `)

  // edit tests to introduce snapshot errors
  editFile(testFile, s => s
    .replace('`hahaha`', '`hahaha-edit`')
    .replace('`popopo`', '`popopo-edit`')
    .replace('`pepepe`', '`pepepe-edit`')
    .replace('`hehehe`', '`hehehe-edit`'))

  result = await runVitest({ root, update: 'none' })
  expect(result.stderr).toMatchInlineSnapshot(`
    "
    ⎯⎯⎯⎯⎯⎯ Failed Suites 1 ⎯⎯⎯⎯⎯⎯⎯

     FAIL  basic.test.ts [ basic.test.ts ]
    Error: Obsolete snapshots found when no snapshot update is expected.
    · properties 1 1
    · properties 2 1

    ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/5]⎯


    ⎯⎯⎯⎯⎯⎯⎯ Failed Tests 4 ⎯⎯⎯⎯⎯⎯⎯

     FAIL  basic.test.ts > file
    Error: [custom error] Snapshot \`file 1\` mismatched

    - Expected
    + Received

      Object {
    -   "length": 6,
    +   "length": 11,
    -   "reversed": "ahahah",
    +   "reversed": "tide-ahahah",
      }

     ❯ basic.test.ts:46:25
         44|
         45| test('file', () => {
         46|   expect(\`hahaha-edit\`).toMatchCustomSnapshot()
           |                         ^
         47| })
         48|

    ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯
    Serialized Error: { context: { assertionName: 'toMatchCustomSnapshot', meta: undefined } }
    ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/5]⎯

     FAIL  basic.test.ts > properties 1
    Error: [custom error] Snapshot properties mismatched

    - Expected
    + Received

      {
    -   "length": 6,
    +   "length": 11,
    +   "reversed": "tide-opopop",
      }

     ❯ basic.test.ts:50:25
         48|
         49| test('properties 1', () => {
         50|   expect(\`popopo-edit\`).toMatchCustomSnapshot({ length: 6 })
           |                         ^
         51| })
         52|

    ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯
    Serialized Error: { context: { assertionName: 'toMatchCustomSnapshot', meta: undefined } }
    ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[3/5]⎯

     FAIL  basic.test.ts > properties 2
    Error: [custom error] Snapshot properties mismatched

    - Expected
    + Received

      {
    -   "length": toSatisfy<[Function lessThan10]>,
    +   "length": 11,
    +   "reversed": "tide-epepep",
      }

     ❯ basic.test.ts:54:25
         52|
         53| test('properties 2', () => {
         54|   expect(\`pepepe-edit\`).toMatchCustomSnapshot({ length: expect.toSatis…
           |                         ^
         55| })
         56|

    ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯
    Serialized Error: { context: { assertionName: 'toMatchCustomSnapshot', meta: undefined } }
    ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[4/5]⎯

     FAIL  basic.test.ts > inline
    Error: [custom error] Snapshot \`inline 1\` mismatched

    - Expected
    + Received

      Object {
    -   "length": 6,
    +   "length": 11,
    -   "reversed": "eheheh",
    +   "reversed": "tide-eheheh",
      }

     ❯ basic.test.ts:59:25
         57| // -- TEST INLINE START --
         58| test('inline', () => {
         59|   expect(\`hehehe-edit\`).toMatchCustomInlineSnapshot(\`
           |                         ^
         60|     Object {
         61|       "length": 6,

    ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯
    Serialized Error: { context: { assertionName: 'toMatchCustomInlineSnapshot', meta: undefined } }
    ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[5/5]⎯

    "
  `)
  expect(result.errorTree()).toMatchInlineSnapshot(`
    Object {
      "basic.test.ts": Object {
        "__module_errors__": Array [
          "Obsolete snapshots found when no snapshot update is expected.
    · properties 1 1
    · properties 2 1
    ",
        ],
        "file": Array [
          "[custom error] Snapshot \`file 1\` mismatched",
        ],
        "inline": Array [
          "[custom error] Snapshot \`inline 1\` mismatched",
        ],
        "properties 1": Array [
          "[custom error] Snapshot properties mismatched",
        ],
        "properties 2": Array [
          "[custom error] Snapshot properties mismatched",
        ],
      },
    }
  `)

  // run with update
  result = await runVitest({ root, update: 'all' })
  expect(result.stderr).toMatchInlineSnapshot(`
    "
    ⎯⎯⎯⎯⎯⎯⎯ Failed Tests 2 ⎯⎯⎯⎯⎯⎯⎯

     FAIL  basic.test.ts > properties 1
    Error: [custom error] Snapshot properties mismatched

    - Expected
    + Received

      {
    -   "length": 6,
    +   "length": 11,
    +   "reversed": "tide-opopop",
      }

     ❯ basic.test.ts:50:25
         48|
         49| test('properties 1', () => {
         50|   expect(\`popopo-edit\`).toMatchCustomSnapshot({ length: 6 })
           |                         ^
         51| })
         52|

    ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯
    Serialized Error: { context: { assertionName: 'toMatchCustomSnapshot', meta: undefined } }
    ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/2]⎯

     FAIL  basic.test.ts > properties 2
    Error: [custom error] Snapshot properties mismatched

    - Expected
    + Received

      {
    -   "length": toSatisfy<[Function lessThan10]>,
    +   "length": 11,
    +   "reversed": "tide-epepep",
      }

     ❯ basic.test.ts:54:25
         52|
         53| test('properties 2', () => {
         54|   expect(\`pepepe-edit\`).toMatchCustomSnapshot({ length: expect.toSatis…
           |                         ^
         55| })
         56|

    ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯
    Serialized Error: { context: { assertionName: 'toMatchCustomSnapshot', meta: undefined } }
    ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/2]⎯

    "
  `)
  expect(readFileSync(snapshotFile, 'utf-8')).toMatchInlineSnapshot(`
    "// Vitest Snapshot v1, https://vitest.dev/guide/snapshot.html

    exports[\`file 1\`] = \`
    Object {
      "length": 11,
      "reversed": "tide-ahahah",
    }
    \`;
    "
  `)
  expect(extractInlineBlocks(readFileSync(testFile, 'utf-8'))).toMatchInlineSnapshot(`
    "test('inline', () => {
      expect(\`hehehe-edit\`).toMatchCustomInlineSnapshot(\`
        Object {
          "length": 11,
          "reversed": "tide-eheheh",
        }
      \`)
    })"
  `)
  expect(result.errorTree()).toMatchInlineSnapshot(`
    Object {
      "basic.test.ts": Object {
        "file": "passed",
        "inline": "passed",
        "properties 1": Array [
          "[custom error] Snapshot properties mismatched",
        ],
        "properties 2": Array [
          "[custom error] Snapshot properties mismatched",
        ],
      },
    }
  `)
})
