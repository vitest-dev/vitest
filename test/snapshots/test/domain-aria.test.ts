import fs, { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, test } from 'vitest'
import { editFile, runVitest } from '../../test-utils'

test('aria snapshot', async () => {
  const root = join(import.meta.dirname, 'fixtures/domain-aria')
  const testFile = join(root, 'basic.test.ts')
  const snapshotFile = join(root, '__snapshots__/basic.test.ts.snap')

  // clean slate
  fs.rmSync(join(root, '__snapshots__'), { recursive: true, force: true })

  // create snapshots from scratch — literal rendered values
  let result = await runVitest({ root, update: 'new' })
  expect(result.stderr).toMatchInlineSnapshot(`""`)
  expect(result.errorTree()).toMatchInlineSnapshot(`
    Object {
      "basic.test.ts": Object {
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
      - heading "Dashboard" [level=1]
      - navigation "Actions":
        - button "Save"
        - button "Cancel"
    \`;

    exports[\`semantic match with regex in snapshot 1\`] = \`
    - paragraph: Original
    - button "1234": Pattern
    \`;

    exports[\`simple heading and paragraph 1\`] = \`
    - heading "Hello World" [level=1]
    - paragraph: Some description
    \`;
    "
  `)

  // hand-edit snapshot to introduce regex patterns for "semantic match" test
  editFile(snapshotFile, s => s
    .replace(`- button "1234"`, `- button /\\\\d+/`))

  // re-run without update — regex pattern matches, all pass, snapshot unchanged
  result = await runVitest({ root, update: 'none' })
  expect(result.stderr).toMatchInlineSnapshot(`""`)
  expect(result.errorTree()).toMatchInlineSnapshot(`
    Object {
      "basic.test.ts": Object {
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
      - heading "Dashboard" [level=1]
      - navigation "Actions":
        - button "Save"
        - button "Cancel"
    \`;

    exports[\`semantic match with regex in snapshot 1\`] = \`
    - paragraph: Original
    - button /\\\\d+/: Pattern
    \`;

    exports[\`simple heading and paragraph 1\`] = \`
    - heading "Hello World" [level=1]
    - paragraph: Some description
    \`;
    "
  `)

  // edit test
  editFile(testFile, s => s
    .replace('<p>Original</p>', '<p>Changed</p>')
    .replace(`aria-label="1234"`, `aria-label="9999"`)
  )

  // run without update — literal mismatch causes failure
  result = await runVitest({ root, update: 'none' })
  expect(result.stderr).toMatchInlineSnapshot(`
    "
    ⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

     FAIL  |chromium| basic.test.ts > semantic match with regex in snapshot
    Error: Snapshot \`semantic match with regex in snapshot 1\` mismatched

    Failure screenshot:
      - test/fixtures/domain-aria/__screenshots__/basic.test.ts/semantic-match-with-regex-in-snapshot-1.png

    - Expected
    + Received

    - - paragraph: Original
    + - paragraph: Changed
      - button /\\d+/: Pattern

     ❯ basic.test.ts:35:24
         33|   \`
         34|   // expect(document.body).toMatchAriaSnapshot()
         35|   expect(document.body).toMatchDomainSnapshot("aria")
           |                        ^
         36| })
         37|

    ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯

    "
  `)
  expect(result.errorTree()).toMatchInlineSnapshot(`
    Object {
      "basic.test.ts": Object {
        "nested structure": "passed",
        "semantic match with regex in snapshot": Array [
          "Snapshot \`semantic match with regex in snapshot 1\` mismatched",
        ],
        "simple heading and paragraph": "passed",
      },
    }
  `)

  // run with update
  result = await runVitest({ root, update: 'all' })
  expect(result.stderr).toMatchInlineSnapshot(`""`)
  expect(result.errorTree()).toMatchInlineSnapshot(`
    Object {
      "basic.test.ts": Object {
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
      - heading "Dashboard" [level=1]
      - navigation "Actions":
        - button "Save"
        - button "Cancel"
    \`;

    exports[\`semantic match with regex in snapshot 1\`] = \`
    - paragraph: Changed
    - button /\\\\d+/: Pattern
    \`;

    exports[\`simple heading and paragraph 1\`] = \`
    - heading "Hello World" [level=1]
    - paragraph: Some description
    \`;
    "
  `)
})
