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
      document.body.innerHTML = '<h1>Hello World</h1><p>Some description</p>'
      expect(document.body).toMatchAriaInlineSnapshot(\`
        - heading [level=1]: Hello World
        - paragraph: Some description
      \`)
    })

    test('semantic match with regex in snapshot', () => {
      document.body.innerHTML = \`
        <button aria-label="User 42">Profile</button>
        <p>You have 7 notifications</p>
      \`
      expect(document.body).toMatchAriaInlineSnapshot(\`
        - button "User 42": Profile
        - paragraph: You have 7 notifications
      \`)
    })
    "
  `)

  // hand-edit inline snapshot to introduce regex pattern
  //    "User 42" -> /User \\d+/
  editFile(testFile, s => s
    .replace(`- button "User 42"`, '- button /User \\\\d+/'))

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

  // edit test values: User 42 -> User 99 (regex still matches),
  //    7 notifications -> 3 messages (literal mismatch)
  editFile(testFile, s => s
    .replace(`aria-label="User 42"`, `aria-label="User 99"`)
    .replace(`<p>You have 7 notifications</p>`, `<p>You have 3 messages</p>`))

  // run without update — literal mismatch causes failure
  result = await runVitest({ root, update: 'none' })
  expect(result.stderr).toMatchInlineSnapshot(`
    "
    ⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

     FAIL  basic.test.ts > semantic match with regex in snapshot
    Error: Snapshot \`semantic match with regex in snapshot 1\` mismatched

    - Expected
    + Received

      - button /User \\d+/: Profile
    - - paragraph: You have 7 notifications
    + - paragraph: You have 3 messages

     ❯ basic.test.ts:19:25
         17|     <p>You have 3 messages</p>
         18|   \`
         19|   expect(document.body).toMatchAriaInlineSnapshot(\`
           |                         ^
         20|     - button /User \\\\d+/: Profile
         21|     - paragraph: You have 7 notifications

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
      document.body.innerHTML = '<h1>Hello World</h1><p>Some description</p>'
      expect(document.body).toMatchAriaInlineSnapshot(\`
        - heading [level=1]: Hello World
        - paragraph: Some description
      \`)
    })

    test('semantic match with regex in snapshot', () => {
      document.body.innerHTML = \`
        <button aria-label="User 99">Profile</button>
        <p>You have 3 messages</p>
      \`
      expect(document.body).toMatchAriaInlineSnapshot(\`
        - button /User \\\\d+/: Profile
        - paragraph: You have 3 messages
      \`)
    })
    "
  `)
})
