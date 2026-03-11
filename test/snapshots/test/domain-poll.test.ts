import fs, { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, test } from 'vitest'
import { editFile, runVitest } from '../../test-utils'

test('domain snapshot with poll', async () => {
  const root = join(import.meta.dirname, 'fixtures/domain-poll')
  const testFile = join(root, 'basic.test.ts')
  const snapshotFile = join(root, '__snapshots__/basic.test.ts.snap')

  // clean slate
  fs.rmSync(join(root, '__snapshots__'), { recursive: true, force: true })

  // create snapshots
  let result = await runVitest({ root, update: 'new' })
  expect(result.stderr).toMatchInlineSnapshot(`""`)
  expect(result.errorTree()).toMatchInlineSnapshot(`
    Object {
      "basic.test.ts": Object {
        "stable": "passed",
        "throw then stable": "passed",
        "unstable": "passed",
      },
    }
  `)
  expect(readFileSync(snapshotFile, 'utf-8')).toMatchInlineSnapshot(`
    "// Vitest Snapshot v1, https://vitest.dev/guide/snapshot.html

    exports[\`stable 1\`] = \`
    name=a
    age=23
    \`;

    exports[\`throw then stable 1\`] = \`
    name=b
    age=23
    \`;

    exports[\`unstable 1\`] = \`
    name=c
    __UNSTABLE_TRIAL__=1
    \`;
    "
  `)

  // re-run passes with no snapshot changes
  result = await runVitest({ root, update: 'none' })
  expect(result.stderr).toMatchInlineSnapshot(`""`)
  expect(result.errorTree()).toMatchInlineSnapshot(`
    Object {
      "basic.test.ts": Object {
        "stable": "passed",
        "throw then stable": "passed",
        "unstable": "passed",
      },
    }
  `)

  // unstable passes on 3rd try
  editFile(snapshotFile, s => s
    .replace('__UNSTABLE_TRIAL__=1', '__UNSTABLE_TRIAL__=3'))

  result = await runVitest({ root, update: 'none' })
  expect(result.stderr).toMatchInlineSnapshot(`""`)
  expect(result.errorTree()).toMatchInlineSnapshot(`
    Object {
      "basic.test.ts": Object {
        "stable": "passed",
        "throw then stable": "passed",
        "unstable": "passed",
      },
    }
  `)

  // snapshots updated with first successful poll value
  editFile(snapshotFile, s => s
    .replace('name=b', 'name=b-changed'))

  expect(readFileSync(snapshotFile, 'utf-8')).toMatchInlineSnapshot(`
    "// Vitest Snapshot v1, https://vitest.dev/guide/snapshot.html

    exports[\`stable 1\`] = \`
    name=a
    age=23
    \`;

    exports[\`throw then stable 1\`] = \`
    name=b-changed
    age=23
    \`;

    exports[\`unstable 1\`] = \`
    name=c
    __UNSTABLE_TRIAL__=3
    \`;
    "
  `)

  result = await runVitest({ root, update: 'all' })
  expect(result.stderr).toMatchInlineSnapshot(`""`)
  expect(result.errorTree()).toMatchInlineSnapshot(`
    Object {
      "basic.test.ts": Object {
        "stable": "passed",
        "throw then stable": "passed",
        "unstable": "passed",
      },
    }
  `)
  expect(readFileSync(snapshotFile, 'utf-8')).toMatchInlineSnapshot(`
    "// Vitest Snapshot v1, https://vitest.dev/guide/snapshot.html

    exports[\`stable 1\`] = \`
    name=a
    age=23
    \`;

    exports[\`throw then stable 1\`] = \`
    name=b
    age=23
    \`;

    exports[\`unstable 1\`] = \`
    name=c
    __UNSTABLE_TRIAL__=1
    \`;
    "
  `)

  // mismatch all retries
  editFile(snapshotFile, s => s
    .replace('name=a\n', 'name=a-changed\n'))

  result = await runVitest({ root, update: 'none' })
  expect(result.stderr).toMatchInlineSnapshot(`
    "
    ⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

     FAIL  basic.test.ts > stable
    Error: Snapshot \`stable 1\` mismatched

    - Expected
    + Received

    - name=a-changed
    + name=a
      age=23

     ❯ basic.test.ts:136:24
        134|     // --- STABLE TEST POLL ---
        135|     return { name: 'a', age: '23' }
        136|   }, { timeout: 100 }).toMatchDomainSnapshot('kv')
           |                        ^
        137|   expect(trial).toBe(1)
        138| })

    Caused by: Error: Matcher did not succeed in time.
     ❯ basic.test.ts:132:3

    ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯

    "
  `)
  expect(result.errorTree()).toMatchInlineSnapshot(`
    Object {
      "basic.test.ts": Object {
        "stable": Array [
          "Snapshot \`stable 1\` mismatched",
        ],
        "throw then stable": "passed",
        "unstable": "passed",
      },
    }
  `)

  // throws all retries
  editFile(testFile, s => s
    .replace('// --- STABLE TEST POLL ---', 'throw new Error("STABLE TEST ERROR")'))
  editFile(snapshotFile, s => s
    .replace('name=a-changed\n', 'name=a\n'))

  result = await runVitest({ root, update: 'none' })
  expect(result.stderr).toMatchInlineSnapshot(`
    "
    ⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

     FAIL  basic.test.ts > stable
    Error: STABLE TEST ERROR
     ❯ basic.test.ts:136:24
        134|     throw new Error("STABLE TEST ERROR")
        135|     return { name: 'a', age: '23' }
        136|   }, { timeout: 100 }).toMatchDomainSnapshot('kv')
           |                        ^
        137|   expect(trial).toBe(1)
        138| })

    Caused by: Error: Matcher did not succeed in time.
     ❯ basic.test.ts:132:3

    ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯

    "
  `)
  expect(result.errorTree()).toMatchInlineSnapshot(`
    Object {
      "basic.test.ts": Object {
        "stable": Array [
          "STABLE TEST ERROR",
        ],
        "throw then stable": "passed",
        "unstable": "passed",
      },
    }
  `)

  // poll timeout hangs
  editFile(testFile, s => s
    .replace('throw new Error("STABLE TEST ERROR")', `return new Promise(r => setTimeout(r, 1000))`))

  result = await runVitest({ root, update: 'none' })
  expect(result.stderr).toMatchInlineSnapshot(`
    "
    ⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

     FAIL  basic.test.ts > stable
    Error: poll() never returned a value within the timeout
     ❯ basic.test.ts:136:24
        134|     return new Promise(r => setTimeout(r, 1000))
        135|     return { name: 'a', age: '23' }
        136|   }, { timeout: 100 }).toMatchDomainSnapshot('kv')
           |                        ^
        137|   expect(trial).toBe(1)
        138| })

    Caused by: Error: Matcher did not succeed in time.
     ❯ basic.test.ts:132:3

    ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯

    "
  `)
  expect(result.errorTree()).toMatchInlineSnapshot(`
    Object {
      "basic.test.ts": Object {
        "stable": Array [
          "poll() never returned a value within the timeout",
        ],
        "throw then stable": "passed",
        "unstable": "passed",
      },
    }
  `)

  // result = await runVitest({ root, update: 'none' })
  // expect(result.stderr).toMatchInlineSnapshot(`""`)
  // expect(result.errorTree()).toMatchInlineSnapshot(`
  //   Object {
  //     "basic.test.ts": Object {
  //       "stable": "passed",
  //       "throw then stable": "passed",
  //       "unstable": "passed",
  //     },
  //   }
  // `)
})
