import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, test } from 'vitest'
import { editFile, runVitest } from '../../test-utils'

const SPLITTER = '// --- TEST CASES ---'

function readTestCases(file: string) {
  return readFileSync(file, 'utf-8').split(SPLITTER)[1]
}

test('aria inline snapshot', async () => {
  const root = join(import.meta.dirname, 'fixtures/domain-aria-inline')
  const testFile = join(root, 'basic.test.ts')

  // purge inline snapshots to empty strings, restore test values
  editFile(testFile, s => s
    .replace(/toMatchDomainInlineSnapshot\(`[^`]*`/g, 'toMatchDomainInlineSnapshot(``')
    .replace(/toMatchAriaInlineSnapshot\(`[^`]*`/g, 'toMatchAriaInlineSnapshot('))

  // create snapshots from scratch
  let result = await runVitest({ root, update: 'new' })
  expect(result.stderr).toMatchInlineSnapshot(`""`)
  expect(result.errorTree()).toMatchInlineSnapshot(`
    Object {
      "basic.test.ts": Object {
        "semantic match with regex in snapshot": "passed",
        "simple heading": "passed",
      },
    }
  `)
  expect(readTestCases(testFile)).toMatchInlineSnapshot(`
    "
    test('simple heading', () => {
      document.body.innerHTML = \`
        <h1>Hello World</h1>
        <p>Some description</p>
      \`
      expect(document.body).toMatchDomainInlineSnapshot(\`
        - heading "Hello World" [level=1]
        - paragraph: Some description
      \`, 'aria')
    })

    test('semantic match with regex in snapshot', () => {
      document.body.innerHTML = \`
        <p>Original</p>
        <button aria-label="1234">Pattern</button>
      \`
      expect(document.body).toMatchDomainInlineSnapshot(\`
        - paragraph: Original
        - button "1234": Pattern
      \`, 'aria')
    })
    "
  `)
  expect(result.ctx?.snapshot.summary).toMatchInlineSnapshot(`
    Object {
      "added": 2,
      "didUpdate": false,
      "failure": false,
      "filesAdded": 1,
      "filesRemoved": 0,
      "filesRemovedList": Array [],
      "filesUnmatched": 0,
      "filesUpdated": 0,
      "matched": 0,
      "total": 2,
      "unchecked": 0,
      "uncheckedKeysByFile": Array [],
      "unmatched": 0,
      "updated": 0,
    }
  `)

  // hand-edit inline snapshot to introduce regex pattern
  //    "1234" -> /\\d+/
  editFile(testFile, s => s
    .replace(`- button "1234"`, '- button /\\\\d+/'))

  // run without update — regex matches, all pass
  result = await runVitest({ root, update: 'none' })
  expect(result.stderr).toMatchInlineSnapshot(`""`)
  expect(result.errorTree()).toMatchInlineSnapshot(`
    Object {
      "basic.test.ts": Object {
        "semantic match with regex in snapshot": "passed",
        "simple heading": "passed",
      },
    }
  `)

  // edit test
  editFile(testFile, s => s
    .replace('<p>Original</p>', '<p>Changed</p>')
    .replace(`aria-label="1234"`, `aria-label="9999"`))

  // run without update — literal mismatch causes failure
  result = await runVitest({ root, update: 'none' })
  expect(result.stderr).toMatchInlineSnapshot(`
    "
    ⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

     FAIL  |chromium| basic.test.ts > semantic match with regex in snapshot
    Error: Snapshot \`semantic match with regex in snapshot 1\` mismatched

    Failure screenshot:
      - test/fixtures/domain-aria-inline/__screenshots__/basic.test.ts/semantic-match-with-regex-in-snapshot-1.png

    - Expected
    + Received

    - - paragraph: Original
    + - paragraph: Changed
      - button /\\d+/: Pattern

     ❯ basic.test.ts:23:24
         21|     <button aria-label="9999">Pattern</button>
         22|   \`
         23|   expect(document.body).toMatchDomainInlineSnapshot(\`
           |                        ^
         24|     - paragraph: Original
         25|     - button /\\\\d+/: Pattern

    ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯

    "
  `)
  expect(result.errorTree()).toMatchInlineSnapshot(`
    Object {
      "basic.test.ts": Object {
        "semantic match with regex in snapshot": Array [
          "Snapshot \`semantic match with regex in snapshot 1\` mismatched",
        ],
        "simple heading": "passed",
      },
    }
  `)

  // run with update — should overwrite inline snapshot
  result = await runVitest({ root, update: 'all' })
  expect(result.stderr).toMatchInlineSnapshot(`""`)
  expect(result.errorTree()).toMatchInlineSnapshot(`
    Object {
      "basic.test.ts": Object {
        "semantic match with regex in snapshot": "passed",
        "simple heading": "passed",
      },
    }
  `)

  // verify inline snapshot in source was rewritten correctly
  expect(readTestCases(testFile)).toMatchInlineSnapshot(`
    "
    test('simple heading', () => {
      document.body.innerHTML = \`
        <h1>Hello World</h1>
        <p>Some description</p>
      \`
      expect(document.body).toMatchDomainInlineSnapshot(\`
        - heading "Hello World" [level=1]
        - paragraph: Some description
      \`, 'aria')
    })

    test('semantic match with regex in snapshot', () => {
      document.body.innerHTML = \`
        <p>Changed</p>
        <button aria-label="9999">Pattern</button>
      \`
      expect(document.body).toMatchDomainInlineSnapshot(\`
        - paragraph: Changed
        - button /\\\\d+/: Pattern
      \`, 'aria')
    })
    "
  `)
})
