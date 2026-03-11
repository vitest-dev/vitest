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
      "aria.test.ts": Object {
        "captureAriaTree": Object {
          "anchor without href has no role": "passed",
          "aria-hidden elements are excluded": "passed",
          "aria-label sets name": "passed",
          "checkbox states": "passed",
          "explicit role overrides implicit": "passed",
          "heading": "passed",
          "label for input": "passed",
          "link with href": "passed",
          "nested list structure": "passed",
        },
        "matchAriaTree": Object {
          "attribute match — checked": "passed",
          "attribute mismatch — wrong level": "passed",
          "contain semantics — order matters": "passed",
          "contain semantics — partial children match": "passed",
          "deep match — finds node in subtree": "passed",
          "exact match": "passed",
          "name match": "passed",
          "regex name match": "passed",
          "regex text child": "passed",
          "role mismatch": "passed",
        },
        "parseAriaTemplate": Object {
          "heading with level": "passed",
          "inline regex text child": "passed",
          "inline text child": "passed",
          "nested children": "passed",
          "role with attributes": "passed",
          "role with quoted name": "passed",
          "role with regex name": "passed",
          "simple role": "passed",
          "text node": "passed",
        },
        "render -> parse roundtrip": Object {
          "rendered output parses back to matching template": "passed",
        },
        "renderAriaTree": Object {
          "checkbox attributes": "passed",
          "form with inputs": "passed",
          "heading with level": "passed",
          "nav with nested list": "passed",
        },
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
