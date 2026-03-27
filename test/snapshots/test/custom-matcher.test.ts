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

     ❯ basic.test.ts:40:25
         38|
         39| test('file', () => {
         40|   expect(\`hahaha-edit\`).toMatchCustomSnapshot()
           |                         ^
         41| })
         42|

    ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/4]⎯

     FAIL  basic.test.ts > properties 1
    Error: [custom error] Snapshot properties mismatched

    - Expected
    + Received

      {
    -   "length": 6,
    +   "length": 11,
    +   "reversed": "tide-opopop",
      }

     ❯ basic.test.ts:44:25
         42|
         43| test('properties 1', () => {
         44|   expect(\`popopo-edit\`).toMatchCustomSnapshot({ length: 6 })
           |                         ^
         45| })
         46|

    ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/4]⎯

     FAIL  basic.test.ts > properties 2
    Error: [custom error] Snapshot properties mismatched

    - Expected
    + Received

      {
    -   "length": toSatisfy<[Function lessThan10]>,
    +   "length": 11,
    +   "reversed": "tide-epepep",
      }

     ❯ basic.test.ts:48:25
         46|
         47| test('properties 2', () => {
         48|   expect(\`pepepe-edit\`).toMatchCustomSnapshot({ length: expect.toSatis…
           |                         ^
         49| })
         50|

    ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[3/4]⎯

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

     ❯ basic.test.ts:53:25
         51| // -- TEST INLINE START --
         52| test('inline', () => {
         53|   expect(\`hehehe-edit\`).toMatchCustomInlineSnapshot(\`
           |                         ^
         54|     Object {
         55|       "length": 6,

    ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[4/4]⎯

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

     ❯ basic.test.ts:44:25
         42|
         43| test('properties 1', () => {
         44|   expect(\`popopo-edit\`).toMatchCustomSnapshot({ length: 6 })
           |                         ^
         45| })
         46|

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

     ❯ basic.test.ts:48:25
         46|
         47| test('properties 2', () => {
         48|   expect(\`pepepe-edit\`).toMatchCustomSnapshot({ length: expect.toSatis…
           |                         ^
         49| })
         50|

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
