import fs, { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { playwright } from '@vitest/browser-playwright'
import { expect, test } from 'vitest'
import { editFile, runInlineTests, runVitest } from '../../test-utils'
import { extractInlineSnaphsots } from './utils'

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
  const rawSnapshotFile = join(root, '__snapshots__/raw.txt')

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
  expect(readFileSync(rawSnapshotFile, 'utf-8')).toMatchInlineSnapshot(`
    "Object {
      "length": 6,
      "reversed": "ihihih",
    }"
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
        "raw": "passed",
      },
    }
  `)

  // edit tests to introduce snapshot errors
  editFile(testFile, s => s
    .replace('`hahaha`', '`hahaha-edit`')
    .replace('`popopo`', '`popopo-edit`')
    .replace('`pepepe`', '`pepepe-edit`')
    .replace('`hihihi`', '`hihihi-edit`')
    .replace('`hehehe`', '`hehehe-edit`'))

  result = await runVitest({ root, update: 'none' })
  expect(result.stderr).toMatchInlineSnapshot(`
    "
    ⎯⎯⎯⎯⎯⎯⎯ Failed Tests 5 ⎯⎯⎯⎯⎯⎯⎯

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

     ❯ basic.test.ts:44:25
         42|
         43| test('file', () => {
         44|   expect(\`hahaha-edit\`).toMatchCustomSnapshot()
           |                         ^
         45| })
         46|

    ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/5]⎯

     FAIL  basic.test.ts > properties 1
    Error: [custom error] Snapshot properties mismatched

    - Expected
    + Received

      {
    -   "length": 6,
    +   "length": 11,
    +   "reversed": "tide-opopop",
      }

     ❯ basic.test.ts:48:25
         46|
         47| test('properties 1', () => {
         48|   expect(\`popopo-edit\`).toMatchCustomSnapshot({ length: 6 })
           |                         ^
         49| })
         50|

    ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/5]⎯

     FAIL  basic.test.ts > properties 2
    Error: [custom error] Snapshot properties mismatched

    - Expected
    + Received

      {
    -   "length": toSatisfy<[Function lessThan10]>,
    +   "length": 11,
    +   "reversed": "tide-epepep",
      }

     ❯ basic.test.ts:52:25
         50|
         51| test('properties 2', () => {
         52|   expect(\`pepepe-edit\`).toMatchCustomSnapshot({ length: expect.toSatis…
           |                         ^
         53| })
         54|

    ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[3/5]⎯

     FAIL  basic.test.ts > raw
    Error: [custom error] Snapshot \`raw 1\` mismatched

    - Expected
    + Received

      Object {
    -   "length": 6,
    +   "length": 11,
    -   "reversed": "ihihih",
    +   "reversed": "tide-ihihih",
      }

     ❯ basic.test.ts:56:3
         54|
         55| test('raw', async () => {
         56|   await expect(\`hihihi-edit\`).toMatchCustomFileSnapshot('./__snapshots…
           |   ^
         57| })
         58|

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

     ❯ basic.test.ts:61:25
         59| // -- TEST INLINE START --
         60| test('inline', () => {
         61|   expect(\`hehehe-edit\`).toMatchCustomInlineSnapshot(\`
           |                         ^
         62|     Object {
         63|       "length": 6,

    ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[5/5]⎯

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
        "raw": Array [
          "[custom error] Snapshot \`raw 1\` mismatched",
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

     ❯ basic.test.ts:48:25
         46|
         47| test('properties 1', () => {
         48|   expect(\`popopo-edit\`).toMatchCustomSnapshot({ length: 6 })
           |                         ^
         49| })
         50|

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

     ❯ basic.test.ts:52:25
         50|
         51| test('properties 2', () => {
         52|   expect(\`pepepe-edit\`).toMatchCustomSnapshot({ length: expect.toSatis…
           |                         ^
         53| })
         54|

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
  expect(readFileSync(rawSnapshotFile, 'utf-8')).toMatchInlineSnapshot(`
    "Object {
      "length": 11,
      "reversed": "tide-ihihih",
    }"
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
        "raw": "passed",
      },
    }
  `)
})

test('browser', async () => {
  const result = await runInlineTests({
    'basic.test.ts': `
import { test, expect, toMatchFileSnapshot, toMatchInlineSnapshot, toMatchSnapshot } from 'vitest'

expect.extend({
  toMatchTrimmedSnapshot(received: string) {
    return toMatchSnapshot.call(this, received.slice(0, 10))
  },
  toMatchTrimmedInlineSnapshot(received: string, inlineSnapshot?: string) {
    return toMatchInlineSnapshot.call(this, received.slice(0, 10), inlineSnapshot)
  },
  async toMatchTrimmedFileSnapshot(received: string, filepath: string) {
    return toMatchFileSnapshot.call(this, received.slice(0, 10), filepath)
  },
})

test('file snapshot', () => {
  expect('extra long string oh my gerd').toMatchTrimmedSnapshot()
})

test('inline snapshot', () => {
  expect('super long string oh my gerd').toMatchTrimmedInlineSnapshot()
})

test('raw file snapshot', async () => {
  await expect('crazy long string oh my gerd').toMatchTrimmedFileSnapshot('./raw.txt')
})
`,
  }, {
    update: 'all',
    browser: {
      enabled: true,
      headless: true,
      screenshotFailures: false,
      provider: playwright(),
      instances: [
        {
          browser: 'chromium',
        },
      ],
    },
  })
  expect(result.stderr).toMatchInlineSnapshot(`""`)
  expect(result.errorTree()).toMatchInlineSnapshot(`
    Object {
      "basic.test.ts": Object {
        "file snapshot": "passed",
        "inline snapshot": "passed",
        "raw file snapshot": "passed",
      },
    }
  `)
  expect(result.fs.readFile('__snapshots__/basic.test.ts.snap')).toMatchInlineSnapshot(`
    "// Vitest Snapshot v1, https://vitest.dev/guide/snapshot.html

    exports[\`file snapshot 1\`] = \`"extra long"\`;
    "
  `)
  expect(extractInlineSnaphsots(result.fs.readFile('basic.test.ts'))).toMatchInlineSnapshot(`
    "
    expect('super long string oh my gerd').toMatchTrimmedInlineSnapshot(\`"super long"\`)
    "
  `)
  expect(result.fs.readFile('raw.txt')).toMatchInlineSnapshot(`"crazy long"`)
})
