import fs, { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, test } from 'vitest'
import { editFile, runVitest } from '../../test-utils'

test('domain snapshot', async () => {
  const root = join(import.meta.dirname, 'fixtures/domain')
  const testFile = join(root, 'aria-snapshot.test.ts')
  const snapshotFile = join(root, '__snapshots__/aria-snapshot.test.ts.snap')

  // clean slate
  fs.rmSync(join(root, '__snapshots__'), { recursive: true, force: true })

  // 1. create snapshots from scratch — should produce literal rendered values
  let result = await runVitest({ root, update: 'new' })
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
      "basic.test.ts": Object {
        "toMatchDomainSnapshot regex match": "passed",
        "toMatchDomainSnapshot simple": "passed",
      },
    }
  `)

  // first run should produce literal values, not regex patterns
  let snap = readFileSync(snapshotFile, 'utf-8')
  expect(snap).toMatchInlineSnapshot(`
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

  // 2. hand-edit snapshot to introduce regex patterns
  //    for "semantic match with regex in snapshot" test case
  editFile(snapshotFile, s => s
    .replace('button "User 42": Profile', 'button /User \\d+/: Profile')
    .replace('paragraph: You have 7 notifications', 'paragraph: /You have \\d+ notifications/'),
  )

  // 3. re-run without update — regex patterns match, tests pass, snapshot unchanged
  const snapWithRegex = readFileSync(snapshotFile, 'utf-8')
  result = await runVitest({ root })
  expect(result.stderr).toMatchInlineSnapshot(`
    "
    ⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

     FAIL  aria-snapshot.test.ts > semantic match with regex in snapshot
    Error: Snapshot \`semantic match with regex in snapshot 1\` mismatched

    - Expected
    + Received

    - - button /User d+/: Profile
    + - button "User 42": Profile
    - - paragraph: /You have d+ notifications/
    + - paragraph: You have 7 notifications

     ❯ aria-snapshot.test.ts:63:25
         61|     <p>You have 7 notifications</p>
         62|   \`
         63|   expect(document.body).toMatchDomainSnapshot('aria')
           |                         ^
         64| })
         65|

    ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯

    "
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
    - button /User d+/: Profile
    - paragraph: /You have d+ notifications/
    \`;

    exports[\`simple heading and paragraph 1\`] = \`
    - heading [level=1]: Hello World
    - paragraph: Some description
    \`;
    "
  `)

  // 4. edit test to change DOM so paragraph regex no longer matches,
  //    but button regex still matches
  editFile(testFile, s => s.replace(
    'You have 7 notifications',
    'Your inbox is empty',
  ))

  // 5. run without update — should fail on the regex mismatch
  result = await runVitest({ root })
  expect(result.stderr).toMatchInlineSnapshot(`
    "
    ⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

     FAIL  aria-snapshot.test.ts > semantic match with regex in snapshot
    Error: Snapshot \`semantic match with regex in snapshot 1\` mismatched

    - Expected
    + Received

    - - button /User d+/: Profile
    + - button "User 42": Profile
    - - paragraph: /You have d+ notifications/
    + - paragraph: Your inbox is empty

     ❯ aria-snapshot.test.ts:63:25
         61|     <p>Your inbox is empty</p>
         62|   \`
         63|   expect(document.body).toMatchDomainSnapshot('aria')
           |                         ^
         64| })
         65|

    ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯

    "
  `)
  expect(result.errorTree()).toMatchInlineSnapshot(`
    Object {
      "aria-snapshot.test.ts": Object {
        "checkbox states": "passed",
        "expect(element) - capture from DOM element": "passed",
        "form with labelled inputs": "passed",
        "navigation with links": "passed",
        "semantic match with regex in snapshot": Array [
          "Snapshot \`semantic match with regex in snapshot 1\` mismatched",
        ],
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
      "basic.test.ts": Object {
        "toMatchDomainSnapshot regex match": "passed",
        "toMatchDomainSnapshot simple": "passed",
      },
    }
  `)

  // 6. run with update — should preserve button regex (still matches),
  //    overwrite paragraph with literal (no longer matches)
  result = await runVitest({ root, update: 'all' })
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
      "basic.test.ts": Object {
        "toMatchDomainSnapshot regex match": "passed",
        "toMatchDomainSnapshot simple": "passed",
      },
    }
  `)

  snap = readFileSync(snapshotFile, 'utf-8')
  expect(snap).toMatchInlineSnapshot(`
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
    - paragraph: Your inbox is empty
    \`;

    exports[\`simple heading and paragraph 1\`] = \`
    - heading [level=1]: Hello World
    - paragraph: Some description
    \`;
    "
  `)
})
