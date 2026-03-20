/**
 * pollAssertDomain behavior matrix
 *
 * Stability requirement: poll must produce two consecutive identical renders.
 * When a reference exists (and not `update: all`), the stable value must also
 * pass `adapter.match` — otherwise the baseline resets and polling continues
 * through intermediate stable states.
 *
 * Poll behavior          | no reference         | has reference (match)  | has reference (mismatch)
 * -----------------------|----------------------|------------------------|-------------------------
 * stable immediately     | new: pass (creates)  | none/new/all: pass     | none/new: fail (diff)
 *                        | none: fail (missing) |                        | all: pass (rewrites)
 *                        | all: pass (creates)  |                        |
 * throw then stable      | same as above        | pass (throw resets     | same as above
 *                        |                      |   baseline, re-polls)  |
 * transitional → stable  | same as above        | pass (rides through    | same as above
 *                        |                      |   intermediate states) |
 * stable wrong → right   | n/a (no ref to       | pass (match rejects    | n/a
 *                        |   reject against)    |   wrong, rides through)|
 * never stabilizes       | fail (unstable)      | fail (unstable)        | fail (unstable)
 * always throws          | fail (unstable,      | fail (unstable,        | fail (unstable,
 *                        |   cause: poll error) |   cause: poll error)   |   cause: poll error)
 * poll hangs             | fail (unstable)      | fail (unstable)        | fail (unstable)
 */
import fs, { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, test } from 'vitest'
import { editFile, runInlineTests, runVitest } from '../../test-utils'

test('domain snapshot with poll', async () => {
  const root = join(import.meta.dirname, 'fixtures/domain-poll')
  const testFile = join(root, 'basic.test.ts')
  const snapshotFile = join(root, '__snapshots__/basic.test.ts.snap')

  // clean slate
  fs.rmSync(join(root, '__snapshots__'), { recursive: true, force: true })

  // --- create snapshots (update: new) ---
  // "never stabilizes" should fail, everything else passes
  let result = await runVitest({ root, update: 'new' })
  expect(result.stderr).toMatchInlineSnapshot(`""`)
  expect(result.errorTree()).toMatchInlineSnapshot(`
    Object {
      "basic.test.ts": Object {
        "multiple poll snapshots": "passed",
        "non-poll alongside poll": "passed",
        "stable": "passed",
        "stable wrong then right": "passed",
        "throw then stable": "passed",
        "transitional then stable": "passed",
      },
    }
  `)
  expect(readFileSync(snapshotFile, 'utf-8')).toMatchInlineSnapshot(`
    "// Vitest Snapshot v1, https://vitest.dev/guide/snapshot.html

    exports[\`multiple poll snapshots 1\`] = \`
    x=1
    \`;

    exports[\`multiple poll snapshots 2\`] = \`
    y=2
    \`;

    exports[\`non-poll alongside poll 1\`] = \`
    static=value
    \`;

    exports[\`non-poll alongside poll 2\`] = \`
    polled=value
    \`;

    exports[\`non-poll alongside poll 3\`] = \`
    another=static
    \`;

    exports[\`stable 1\`] = \`
    name=a
    age=23
    \`;

    exports[\`stable wrong then right 1\`] = \`
    status=loading
    \`;

    exports[\`throw then stable 1\`] = \`
    name=b
    age=23
    \`;

    exports[\`transitional then stable 1\`] = \`
    status=loading
    \`;
    "
  `)

  // --- re-run unchanged (update: none) ---
  const result2 = await runVitest({ root, update: 'none' })
  expect(result2.stderr).toBe(result.stderr)
  expect(result2.errorTree()).toEqual(result.errorTree())

  // --- mismatch — stable on wrong value ---
  // Edit reference so "stable" poll stabilizes but doesn't match
  // Should produce a mismatch error with diff, not "unstable" error
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

     ❯ basic.test.ts:11:24
          9|     trial++
         10|     return { name: 'a', age: '23' }
         11|   }, { interval: 10 }).toMatchDomainSnapshot('kv')
           |                        ^
         12|   expect(trial).toBe(2)
         13| })

    Caused by: Error: Matcher did not succeed in time.
     ❯ basic.test.ts:8:3

    ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯

    "
  `)
  expect(result.errorTree()).toMatchInlineSnapshot(`
    Object {
      "basic.test.ts": Object {
        "multiple poll snapshots": "passed",
        "non-poll alongside poll": "passed",
        "stable": Array [
          "Snapshot \`stable 1\` mismatched",
        ],
        "stable wrong then right": "passed",
        "throw then stable": "passed",
        "transitional then stable": "passed",
      },
    }
  `)

  // TODO
  if (1) { return }

  // --- update mode (update: all) ---
  // Rewrite snapshots with current stable values
  result = await runVitest({ root, update: 'all' })
  expect(result.stderr).toMatchInlineSnapshot()
  expect(result.errorTree()).toMatchInlineSnapshot()
  expect(readFileSync(snapshotFile, 'utf-8')).toMatchInlineSnapshot()

  // --- poll always throws ---
  editFile(testFile, s => s
    .replace('return { name: \'a\', age: \'23\' }', 'throw new Error("ALWAYS_THROWS")'))

  result = await runVitest({ root, update: 'none' })
  expect(result.stderr).toMatchInlineSnapshot()
  expect(result.errorTree()).toMatchInlineSnapshot()

  // --- poll hangs (never resolves within timeout) ---
  editFile(testFile, s => s
    .replace('throw new Error("ALWAYS_THROWS")', 'return new Promise(r => setTimeout(r, 10000))'))

  result = await runVitest({ root, update: 'none' })
  expect(result.stderr).toMatchInlineSnapshot()
  expect(result.errorTree()).toMatchInlineSnapshot()

  // --- pattern-preserving update ---
  // Restore poll, inject regex pattern into snapshot, verify --update preserves it
  editFile(testFile, s => s
    .replace('return new Promise(r => setTimeout(r, 10000))', 'return { name: \'a\', age: \'23\' }'))
  editFile(snapshotFile, s => s
    .replace('name=a\n', 'name=/\\\\w/\n'))

  result = await runVitest({ root, update: 'all' })
  expect(result.stderr).toMatchInlineSnapshot()
  expect(result.errorTree()).toMatchInlineSnapshot()
  expect(readFileSync(snapshotFile, 'utf-8')).toMatchInlineSnapshot()
})

test('errors', async () => {
  const result = await runInlineTests({
    'basic.test.ts': `
import { expect, test } from 'vitest'
import { kvAdapter } from '../test/fixtures/domain/basic'

expect.addSnapshotDomain(kvAdapter)

test('unstable', async () => {
  let trial = 0
  await expect.poll(() => {
    trial++
    return { name: 'x', counter: String(trial) }
  }, { timeout: 100, interval: 10 }).toMatchDomainSnapshot('kv')
})

test('hanging', async () => {
  let trial = 0
  await expect.poll(() => {
    trial++
    return new Promise(() => {})
  }, { timeout: 100, interval: 10 }).toMatchDomainSnapshot('kv')
})

test('throwing', async () => {
  let trial = 0
  await expect.poll(() => {
    trial++
    throw new Error("ALWAYS_THROWS")
  }, { timeout: 100, interval: 10 }).toMatchDomainSnapshot('kv')
})
`,
  }, {
    update: 'all',
  })
  expect(result.stderr).toMatchInlineSnapshot(`
    "
    ⎯⎯⎯⎯⎯⎯⎯ Failed Tests 3 ⎯⎯⎯⎯⎯⎯⎯

     FAIL  basic.test.ts > unstable
    Error: poll() did not produce a stable snapshot within the timeout
     ❯ basic.test.ts:12:38
         10|     trial++
         11|     return { name: 'x', counter: String(trial) }
         12|   }, { timeout: 100, interval: 10 }).toMatchDomainSnapshot('kv')
           |                                      ^
         13| })
         14|

    Caused by: Error: Matcher did not succeed in time.
     ❯ basic.test.ts:9:3

    ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/3]⎯

     FAIL  basic.test.ts > hanging
    Error: poll() did not produce a stable snapshot within the timeout
     ❯ basic.test.ts:20:38
         18|     trial++
         19|     return new Promise(() => {})
         20|   }, { timeout: 100, interval: 10 }).toMatchDomainSnapshot('kv')
           |                                      ^
         21| })
         22|

    Caused by: Error: Matcher did not succeed in time.
     ❯ basic.test.ts:17:3

    ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/3]⎯

     FAIL  basic.test.ts > throwing
    Error: ALWAYS_THROWS
     ❯ basic.test.ts:28:38
         26|     trial++
         27|     throw new Error("ALWAYS_THROWS")
         28|   }, { timeout: 100, interval: 10 }).toMatchDomainSnapshot('kv')
           |                                      ^
         29| })
         30|

    Caused by: Error: Matcher did not succeed in time.
     ❯ basic.test.ts:25:3

    ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[3/3]⎯

    "
  `)
  expect(result.errorTree()).toMatchInlineSnapshot(`
    Object {
      "basic.test.ts": Object {
        "hanging": Array [
          "poll() did not produce a stable snapshot within the timeout",
        ],
        "throwing": Array [
          "ALWAYS_THROWS",
        ],
        "unstable": Array [
          "poll() did not produce a stable snapshot within the timeout",
        ],
      },
    }
  `)
})
