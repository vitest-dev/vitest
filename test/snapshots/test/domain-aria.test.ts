import fs, { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, test } from 'vitest'
import { runVitest } from '../../test-utils'

// TODO: test diff, partial update, etc.
test('aria snapshot', async () => {
  const root = join(import.meta.dirname, 'fixtures/domain-aria')
  const snapshotFile = join(root, '__snapshots__/aria-snapshot.test.ts.snap')

  // clean slate
  fs.rmSync(join(root, '__snapshots__'), { recursive: true, force: true })

  // 1. create snapshots from scratch — literal rendered values
  const result = await runVitest({ root, update: 'new' })
  expect(result.stderr).toMatchInlineSnapshot(`""`)
  expect(result.errorTree()).toMatchInlineSnapshot(`
    Object {
      "aria-snapshot.test.ts": Object {
        "checkbox states": "passed",
        "expect(element) - capture from DOM element": "passed",
        "form with labelled inputs": "passed",
        "navigation with links": "passed",
        "semantic match with regex in snapshot": "passed",
        "simple heading and paragraph": "passed",
      },
    }
  `)
  expect(readFileSync(snapshotFile, 'utf-8')).toMatchInlineSnapshot(`
    "// Vitest Snapshot v1, https://vitest.dev/guide/snapshot.html

    exports[\`checkbox states 1\`] = \`
    - checkbox "Accept terms" [checked]
    - checkbox "Select all" [checked=mixed]
    \`;

    exports[\`expect(element) - capture from DOM element 1\`] = \`
    - main:
      - heading [level=1]: Dashboard
      - navigation "Actions":
        - button: Save
        - button: Cancel
    \`;

    exports[\`form with labelled inputs 1\`] = \`
    - form:
      - text: Username
      - textbox "Username"
      - button: Log in
    \`;

    exports[\`navigation with links 1\`] = \`
    - navigation "Main":
      - list:
        - listitem:
          - link: Home
        - listitem:
          - link: About
        - listitem:
          - link: Contact
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
})
