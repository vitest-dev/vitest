import fs, { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, test } from 'vitest'
import { editFile, runVitest } from '../../test-utils'

const INLINE_BLOCK_RE = /\/\/ -- TEST INLINE START --\n([\s\S]*?)\/\/ -- TEST INLINE END --/g

function extractInlineBlocks(content: string): string {
  return [...content.matchAll(INLINE_BLOCK_RE)].map(m => m[1].trim()).join('\n\n')
}

test('toMatchSnapshot and toMatchInlineSnapshot with properties', async () => {
  const root = join(import.meta.dirname, 'fixtures/properties')
  const testFile = join(root, 'basic.test.ts')
  const snapshotFile = join(root, '__snapshots__/basic.test.ts.snap')

  // remove snapshots
  fs.rmSync(join(root, '__snapshots__'), { recursive: true, force: true })
  editFile(testFile, s =>
    s.replace(/toMatchInlineSnapshot\((\{[^}]*\}),\s*`[^`]*`\)/g, 'toMatchInlineSnapshot($1)'))

  // create snapshots from scratch
  let result = await runVitest({ root, update: 'new' })
  expect(result.stderr).toMatchInlineSnapshot(`""`)
  expect(readFileSync(snapshotFile, 'utf-8')).toMatchInlineSnapshot(`
    "// Vitest Snapshot v1, https://vitest.dev/guide/snapshot.html

    exports[\`file 1\`] = \`
    Object {
      "age": Any<Number>,
      "name": "alice",
    }
    \`;

    exports[\`file asymmetric 1\`] = \`
    Object {
      "name": "bob",
      "score": toSatisfy<[Function lessThan100]>,
    }
    \`;

    exports[\`file snapshot-only 1\`] = \`
    Object {
      "age": Any<Number>,
      "name": "dave",
    }
    \`;
    "
  `)
  expect(extractInlineBlocks(readFileSync(testFile, 'utf-8'))).toMatchInlineSnapshot(`
    "test("inline", () => {
      expect({ name: "carol", age: 25 }).toMatchInlineSnapshot({ age: expect.any(Number) }, \`
        Object {
          "age": Any<Number>,
          "name": "carol",
        }
      \`);
    });"
  `)
  expect(result.errorTree()).toMatchInlineSnapshot(`
    Object {
      "basic.test.ts": Object {
        "file": "passed",
        "file asymmetric": "passed",
        "file snapshot-only": "passed",
        "inline": "passed",
      },
    }
  `)

  // verify idempotency — re-run without update passes cleanly
  const result2 = await runVitest({ root, update: 'none' })
  expect(result2.stderr).toMatchInlineSnapshot(`""`)
  expect(result2.errorTree()).toEqual(result.errorTree())

  // edit tests to break properties check
  editFile(testFile, s =>
    s
      .replace('age: 30', 'age: \'thirty\'')
      .replace('score: 95', 'score: 999')
      .replace('name: "dave"', 'name: "dave-edit"')
      .replace('age: 25', 'age: \'twenty-five\''))

  // properties mismatch should NOT cause false-positive obsolete snapshot
  result = await runVitest({ root, update: 'none' })
  expect(result.stderr).toMatchInlineSnapshot(`
    "
    ⎯⎯⎯⎯⎯⎯⎯ Failed Tests 4 ⎯⎯⎯⎯⎯⎯⎯

     FAIL  basic.test.ts > file
    Error: Snapshot properties mismatched

    - Expected
    + Received

      {
    -   "age": Any<Number>,
    +   "age": "thirty",
    +   "name": "alice",
      }

     ❯ basic.test.ts:4:44
          2|
          3| test("file", () => {
          4|   expect({ name: "alice", age: 'thirty' }).toMatchSnapshot({ age: expe…
           |                                            ^
          5| });
          6|

    ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/4]⎯

     FAIL  basic.test.ts > file asymmetric
    Error: Snapshot properties mismatched

    - Expected
    + Received

      {
    -   "score": toSatisfy<[Function lessThan100]>,
    +   "name": "bob",
    +   "score": 999,
      }

     ❯ basic.test.ts:8:39
          6|
          7| test("file asymmetric", () => {
          8|   expect({ name: "bob", score: 999 }).toMatchSnapshot({
           |                                       ^
          9|     score: expect.toSatisfy(function lessThan100(n) {
         10|       return n < 100;

    ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/4]⎯

     FAIL  basic.test.ts > file snapshot-only
    Error: Snapshot \`file snapshot-only 1\` mismatched

    - Expected
    + Received

      Object {
        "age": Any<Number>,
    -   "name": "dave",
    +   "name": "dave-edit",
      }

     ❯ basic.test.ts:16:42
         14|
         15| test("file snapshot-only", () => {
         16|   expect({ name: "dave-edit", age: 42 }).toMatchSnapshot({ age: expect…
           |                                          ^
         17| });
         18|

    ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[3/4]⎯

     FAIL  basic.test.ts > inline
    Error: Snapshot properties mismatched

    - Expected
    + Received

      {
    -   "age": Any<Number>,
    +   "age": "twenty-five",
    +   "name": "carol",
      }

     ❯ basic.test.ts:21:49
         19| // -- TEST INLINE START --
         20| test("inline", () => {
         21|   expect({ name: "carol", age: 'twenty-five' }).toMatchInlineSnapshot(…
           |                                                 ^
         22|     Object {
         23|       "age": Any<Number>,

    ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[4/4]⎯

    "
  `)
  expect(result.errorTree()).toMatchInlineSnapshot(`
    Object {
      "basic.test.ts": Object {
        "file": Array [
          "Snapshot properties mismatched",
        ],
        "file asymmetric": Array [
          "Snapshot properties mismatched",
        ],
        "file snapshot-only": Array [
          "Snapshot \`file snapshot-only 1\` mismatched",
        ],
        "inline": Array [
          "Snapshot properties mismatched",
        ],
      },
    }
  `)

  // run with update — properties errors persist
  result = await runVitest({ root, update: 'all' })
  expect(result.stderr).toMatchInlineSnapshot(`
    "
    ⎯⎯⎯⎯⎯⎯⎯ Failed Tests 3 ⎯⎯⎯⎯⎯⎯⎯

     FAIL  basic.test.ts > file
    Error: Snapshot properties mismatched

    - Expected
    + Received

      {
    -   "age": Any<Number>,
    +   "age": "thirty",
    +   "name": "alice",
      }

     ❯ basic.test.ts:4:44
          2|
          3| test("file", () => {
          4|   expect({ name: "alice", age: 'thirty' }).toMatchSnapshot({ age: expe…
           |                                            ^
          5| });
          6|

    ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/3]⎯

     FAIL  basic.test.ts > file asymmetric
    Error: Snapshot properties mismatched

    - Expected
    + Received

      {
    -   "score": toSatisfy<[Function lessThan100]>,
    +   "name": "bob",
    +   "score": 999,
      }

     ❯ basic.test.ts:8:39
          6|
          7| test("file asymmetric", () => {
          8|   expect({ name: "bob", score: 999 }).toMatchSnapshot({
           |                                       ^
          9|     score: expect.toSatisfy(function lessThan100(n) {
         10|       return n < 100;

    ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/3]⎯

     FAIL  basic.test.ts > inline
    Error: Snapshot properties mismatched

    - Expected
    + Received

      {
    -   "age": Any<Number>,
    +   "age": "twenty-five",
    +   "name": "carol",
      }

     ❯ basic.test.ts:21:49
         19| // -- TEST INLINE START --
         20| test("inline", () => {
         21|   expect({ name: "carol", age: 'twenty-five' }).toMatchInlineSnapshot(…
           |                                                 ^
         22|     Object {
         23|       "age": Any<Number>,

    ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[3/3]⎯

    "
  `)
  expect(readFileSync(snapshotFile, 'utf-8')).toMatchInlineSnapshot(`
    "// Vitest Snapshot v1, https://vitest.dev/guide/snapshot.html

    exports[\`file 1\`] = \`
    Object {
      "age": Any<Number>,
      "name": "alice",
    }
    \`;

    exports[\`file asymmetric 1\`] = \`
    Object {
      "name": "bob",
      "score": toSatisfy<[Function lessThan100]>,
    }
    \`;

    exports[\`file snapshot-only 1\`] = \`
    Object {
      "age": Any<Number>,
      "name": "dave-edit",
    }
    \`;
    "
  `)
  expect(extractInlineBlocks(readFileSync(testFile, 'utf-8'))).toMatchInlineSnapshot(`
    "test("inline", () => {
      expect({ name: "carol", age: 'twenty-five' }).toMatchInlineSnapshot({ age: expect.any(Number) }, \`
        Object {
          "age": Any<Number>,
          "name": "carol",
        }
      \`);
    });"
  `)
  expect(result.errorTree()).toMatchInlineSnapshot(`
    Object {
      "basic.test.ts": Object {
        "file": Array [
          "Snapshot properties mismatched",
        ],
        "file asymmetric": Array [
          "Snapshot properties mismatched",
        ],
        "file snapshot-only": "passed",
        "inline": Array [
          "Snapshot properties mismatched",
        ],
      },
    }
  `)
})
