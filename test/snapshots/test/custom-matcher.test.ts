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

    exports[\`properties 1\`] = \`
    Object {
      "length": Any<Number>,
      "reversed": "opopop",
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
        "properties": "passed",
      },
    }
  `)

  // edit tests to introduce snapshot errors
  editFile(testFile, s => s
    .replace('`hahaha`', '`hahaha-edit`')
    .replace('`popopo`', '`popopo-edit`')
    .replace('`hehehe`', '`hehehe-edit`'))

  result = await runVitest({ root, update: 'none' })
  expect(result.stderr).toMatchInlineSnapshot(`
    "
    ⎯⎯⎯⎯⎯⎯⎯ Failed Tests 3 ⎯⎯⎯⎯⎯⎯⎯

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
    ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/3]⎯

     FAIL  basic.test.ts > properties
    Error: [custom error] Snapshot \`properties 1\` mismatched

    - Expected
    + Received

      Object {
        "length": Any<Number>,
    -   "reversed": "opopop",
    +   "reversed": "tide-opopop",
      }

     ❯ basic.test.ts:50:25
         48|
         49| test('properties', () => {
         50|   expect(\`popopo-edit\`).toMatchCustomSnapshot({ length: expect.any(Num…
           |                         ^
         51| })
         52|

    ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯
    Serialized Error: { context: { assertionName: 'toMatchCustomSnapshot', meta: undefined } }
    ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/3]⎯

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

     ❯ basic.test.ts:55:25
         53| // -- TEST INLINE START --
         54| test('inline', () => {
         55|   expect(\`hehehe-edit\`).toMatchCustomInlineSnapshot(\`
           |                         ^
         56|     Object {
         57|       "length": 6,

    ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯
    Serialized Error: { context: { assertionName: 'toMatchCustomInlineSnapshot', meta: undefined } }
    ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[3/3]⎯

    "
  `)
  expect(result.errorTree()).toMatchInlineSnapshot(`
    Object {
      "basic.test.ts": Object {
        "file": Array [
          "[custom error] Snapshot \`file 1\` mismatched",
        ],
        "inline": Array [
          "[custom error] Snapshot \`inline 1\` mismatched",
        ],
        "properties": Array [
          "[custom error] Snapshot \`properties 1\` mismatched",
        ],
      },
    }
  `)

  // run with update
  result = await runVitest({ root, update: 'all' })
  expect(result.stderr).toMatchInlineSnapshot(`""`)
  expect(readFileSync(snapshotFile, 'utf-8')).toMatchInlineSnapshot(`
    "// Vitest Snapshot v1, https://vitest.dev/guide/snapshot.html

    exports[\`file 1\`] = \`
    Object {
      "length": 11,
      "reversed": "tide-ahahah",
    }
    \`;

    exports[\`properties 1\`] = \`
    Object {
      "length": Any<Number>,
      "reversed": "tide-opopop",
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
        "properties": "passed",
      },
    }
  `)
})
