import { join } from 'node:path'
import { playwright } from '@vitest/browser-playwright'
import { expect, test } from 'vitest'
import { editFile, runInlineTests, runVitest } from '../../test-utils'
import { readInlineSnapshots } from './utils'

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
  expect(readInlineSnapshots(testFile)).toMatchInlineSnapshot(`
    "
    expect(document.body).toMatchAriaInlineSnapshot(\`
        - heading "Hello World" [level=1]
        - paragraph: Some description
      \`)

    expect(document.body).toMatchAriaInlineSnapshot(\`
        - paragraph: Original
        - button "1234": Pattern
      \`)
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

     ❯ basic.test.ts:19:24
         17|     <button aria-label="9999">Pattern</button>
         18|   \`
         19|   expect(document.body).toMatchAriaInlineSnapshot(\`
           |                        ^
         20|     - paragraph: Original
         21|     - button /\\\\d+/: Pattern

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
  expect(readInlineSnapshots(testFile)).toMatchInlineSnapshot(`
    "
    expect(document.body).toMatchAriaInlineSnapshot(\`
        - heading "Hello World" [level=1]
        - paragraph: Some description
      \`)

    expect(document.body).toMatchAriaInlineSnapshot(\`
        - paragraph: Changed
        - button /\\\\d+/: Pattern
      \`)
    "
  `)
})

test('domain multiple inline at same location - success', async () => {
  const result = await runInlineTests({
    'basic.test.ts': `
import { expect, test } from 'vitest';

test('basic', () => {
  for (let i = 0; i < 3; i++) {
    document.body.innerHTML = "<p>OK</p>";
    expect(document.body).toMatchAriaInlineSnapshot();
  }
});
`,
  }, {
    browser: {
      enabled: true,
      headless: true,
      provider: playwright(),
      instances: [
        {
          browser: 'chromium',
        },
      ],
    },
    update: 'new',
  })
  expect(result.stderr).toMatchInlineSnapshot(`""`)
  expect(result.errorTree()).toMatchInlineSnapshot(`
    Object {
      "basic.test.ts": Object {
        "basic": "passed",
      },
    }
  `)
  expect(result.fs.readFile('basic.test.ts')).toMatchInlineSnapshot(`
    "
    import { expect, test } from 'vitest';

    test('basic', () => {
      for (let i = 0; i < 3; i++) {
        document.body.innerHTML = "<p>OK</p>";
        expect(document.body).toMatchAriaInlineSnapshot(\`- paragraph: OK\`);
      }
    });
    "
  `)
})

test('domain multiple inline at same location - fail', async () => {
  const result = await runInlineTests({
    'basic.test.ts': `
import { expect, test } from 'vitest';

test('basic', () => {
  for (let i = 0; i < 3; i++) {
    document.body.innerHTML = "<p>count - " + i + "</p>";
    expect(document.body).toMatchAriaInlineSnapshot();
  }
});
`,
  }, {
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
    update: 'new',
  })
  expect(result.stderr).toMatchInlineSnapshot(`
    "
    ⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

     FAIL  |chromium| basic.test.ts > basic
    Error: toMatchAriaInlineSnapshot with different snapshots cannot be called at the same location

    - Expected
    + Received


    - - paragraph: count - 0
    + - paragraph: count - 1


     ❯ basic.test.ts:7:26
          5|   for (let i = 0; i < 3; i++) {
          6|     document.body.innerHTML = "<p>count - " + i + "</p>";
          7|     expect(document.body).toMatchAriaInlineSnapshot();
           |                          ^
          8|   }
          9| });

    ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯

    "
  `)
  expect(result.errorTree()).toMatchInlineSnapshot(`
    Object {
      "basic.test.ts": Object {
        "basic": Array [
          "toMatchAriaInlineSnapshot with different snapshots cannot be called at the same location",
        ],
      },
    }
  `)
  expect(result.fs.readFile('basic.test.ts')).toMatchInlineSnapshot(`
    "
    import { expect, test } from 'vitest';

    test('basic', () => {
      for (let i = 0; i < 3; i++) {
        document.body.innerHTML = "<p>count - " + i + "</p>";
        expect(document.body).toMatchAriaInlineSnapshot();
      }
    });
    "
  `)
})

test('template parse error', async () => {
  const result = await runInlineTests({
    'basic.test.ts': `
import { expect, test } from 'vitest';

test('basic', () => {
  expect(document.body).toMatchAriaInlineSnapshot(\`x: y\`);
});
`,
  }, {
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
    update: 'none',
  })
  expect(result.stderr).toMatchInlineSnapshot(`
    "
    ⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

     FAIL  |chromium| basic.test.ts > basic
    Error: Aria snapshot must be a YAML sequence, elements starting with " -"
     ❯ basic.test.ts:5:24
          3|
          4| test('basic', () => {
          5|   expect(document.body).toMatchAriaInlineSnapshot(\`x: y\`);
           |                        ^
          6| });
          7|

    ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯

    "
  `)
  expect(result.errorTree()).toMatchInlineSnapshot(`
    Object {
      "basic.test.ts": Object {
        "basic": Array [
          "Aria snapshot must be a YAML sequence, elements starting with " -"",
        ],
      },
    }
  `)
})
