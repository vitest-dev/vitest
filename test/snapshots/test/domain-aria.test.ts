import fs, { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, test } from 'vitest'
import { editFile, runVitest } from '../../test-utils'

test('aria snapshot', async () => {
  const root = join(import.meta.dirname, 'fixtures/domain-aria')
  const testFile = join(root, 'aria-snapshot.test.ts')
  const snapshotFile = join(root, '__snapshots__/aria-snapshot.test.ts.snap')

  // clean slate
  fs.rmSync(join(root, '__snapshots__'), { recursive: true, force: true })

  // 1. create snapshots from scratch — literal rendered values
  let result = await runVitest({ root, update: 'new' })
  expect(result.stderr).toMatchInlineSnapshot(`""`)
  expect(result.errorTree()).toMatchInlineSnapshot(`
    Object {
      "aria-snapshot.test.ts": Object {
        "nested structure": "passed",
        "semantic match with regex in snapshot": "passed",
        "simple heading and paragraph": "passed",
      },
    }
  `)
  expect(readFileSync(snapshotFile, 'utf-8')).toMatchInlineSnapshot(`
    "// Vitest Snapshot v1, https://vitest.dev/guide/snapshot.html

    exports[\`nested structure 1\`] = \`
    - main:
      - heading [level=1]: Dashboard
      - navigation "Actions":
        - button: Save
        - button: Cancel
    \`;

    exports[\`semantic match with regex in snapshot 1\`] = \`
    - button "User 42": Profile
    - paragraph: You have 7 notifications
    \`;

    exports[\`simple heading and paragraph 1\`] = \`
    - heading [level=1]: Hello World
    - paragraph: Some description
    \`;
    "
  `)

  // 2. hand-edit snapshot to introduce regex patterns for "semantic match" test
  //    "User 42" -> /User \\d+/  (regex, should match any user number)
  //    "7 notifications" stays literal
  editFile(snapshotFile, s => s
    .replace('"User 42"', '/User \\\\d+/'))

  // 3. re-run without update — regex pattern matches, all pass, snapshot unchanged
  result = await runVitest({ root, update: 'none' })
  expect(result.stderr).toMatchInlineSnapshot(`""`)
  expect(result.errorTree()).toMatchInlineSnapshot(`
    Object {
      "aria-snapshot.test.ts": Object {
        "nested structure": "passed",
        "semantic match with regex in snapshot": "passed",
        "simple heading and paragraph": "passed",
      },
    }
  `)
  expect(readFileSync(snapshotFile, 'utf-8')).toMatchInlineSnapshot(`
    "// Vitest Snapshot v1, https://vitest.dev/guide/snapshot.html

    exports[\`nested structure 1\`] = \`
    - main:
      - heading [level=1]: Dashboard
      - navigation "Actions":
        - button: Save
        - button: Cancel
    \`;

    exports[\`semantic match with regex in snapshot 1\`] = \`
    - button /User \\\\d+/: Profile
    - paragraph: You have 7 notifications
    \`;

    exports[\`simple heading and paragraph 1\`] = \`
    - heading [level=1]: Hello World
    - paragraph: Some description
    \`;
    "
  `)

  // 4. edit test: change values within "semantic match"
  //    - User 42 -> User 99  (regex /User \d+/ still matches)
  //    - 7 notifications -> 3 messages  (literal does NOT match)
  editFile(testFile, s => s
    .replace('User 42', 'User 99')
    .replace('You have 7 notifications', 'You have 3 messages'))

  // 5. run without update — literal mismatch causes failure
  result = await runVitest({ root, update: 'none' })
  expect(result.stderr).toMatchInlineSnapshot(`
    "
    ⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

     FAIL  aria-snapshot.test.ts > semantic match with regex in snapshot
    Error: Snapshot \`semantic match with regex in snapshot 1\` mismatched

    - Expected
    + Received

    - - button /User \\d+/: Profile
    + - button "User 99": Profile
    - - paragraph: You have 7 notifications
    + - paragraph: You have 3 messages

     ❯ aria-snapshot.test.ts:28:25
         26|     <p>You have 3 messages</p>
         27|   \`
         28|   expect(document.body).toMatchAriaSnapshot()
           |                         ^
         29| })
         30|

    ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯

    "
  `)
  expect(result.errorTree()).toMatchInlineSnapshot(`
    Object {
      "aria-snapshot.test.ts": Object {
        "nested structure": "passed",
        "semantic match with regex in snapshot": Array [
          "Snapshot \`semantic match with regex in snapshot 1\` mismatched",
        ],
        "simple heading and paragraph": "passed",
      },
    }
  `)

  // 6. run with update — should preserve button name regex (matched),
  //    overwrite paragraph text with literal (didn't match)
  result = await runVitest({ root, update: 'all' })
  expect(result.stderr).toMatchInlineSnapshot(`""`)
  expect(result.errorTree()).toMatchInlineSnapshot(`
    Object {
      "aria-snapshot.test.ts": Object {
        "nested structure": "passed",
        "semantic match with regex in snapshot": "passed",
        "simple heading and paragraph": "passed",
      },
    }
  `)
  // NOTE
  // button name regex matched 'User 99' -> preserved as /User \d+/
  // paragraph literal 'You have 7 notifications' != 'You have 3 messages' -> overwritten
  expect(readFileSync(snapshotFile, 'utf-8')).toMatchInlineSnapshot(`
    "// Vitest Snapshot v1, https://vitest.dev/guide/snapshot.html

    exports[\`nested structure 1\`] = \`
    - main:
      - heading [level=1]: Dashboard
      - navigation "Actions":
        - button: Save
        - button: Cancel
    \`;

    exports[\`semantic match with regex in snapshot 1\`] = \`
    - button "User 99": Profile
    - paragraph: You have 3 messages
    \`;

    exports[\`simple heading and paragraph 1\`] = \`
    - heading [level=1]: Hello World
    - paragraph: Some description
    \`;
    "
  `)
})
