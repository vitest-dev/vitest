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
  const snapshotFile = join(root, '__snapshots__/basic.test.ts.snap')

  // clean slate
  fs.rmSync(join(root, '__snapshots__'), { recursive: true, force: true })

  // --- create snapshots (update: new) ---
  let result = await runVitest({ root, update: 'new' })
  expect(result.stderr).toMatchInlineSnapshot(`""`)
  expect(result.errorTree()).toMatchInlineSnapshot(`
    Object {
      "basic.test.ts": Object {
        "empty snapshot": "passed",
        "multiple poll snapshots": "passed",
        "non-poll alongside poll": "passed",
        "stable": "passed",
        "throw then stable": "passed",
        "unstable then stable": "passed",
      },
    }
  `)
  expect(readFileSync(snapshotFile, 'utf-8')).toMatchInlineSnapshot(`
    "// Vitest Snapshot v1, https://vitest.dev/guide/snapshot.html

    exports[\`empty snapshot 1\`] = \`\`;

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

    exports[\`throw then stable 1\`] = \`
    name=b
    age=23
    \`;

    exports[\`unstable then stable 1\`] = \`
    status=done
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

     ❯ basic.test.ts:9:24
          7|     trial++
          8|     return { name: 'a', age: '23' }
          9|   }, { interval: 10 }).toMatchKvSnapshot()
           |                        ^
         10|   expect(trial).toBe(2)
         11| })

    Caused by: Error: Matcher did not succeed in time.
     ❯ basic.test.ts:6:3

    ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯

    "
  `)
  expect(result.errorTree()).toMatchInlineSnapshot(`
    Object {
      "basic.test.ts": Object {
        "empty snapshot": "passed",
        "multiple poll snapshots": "passed",
        "non-poll alongside poll": "passed",
        "stable": Array [
          "Snapshot \`stable 1\` mismatched",
        ],
        "throw then stable": "passed",
        "unstable then stable": "passed",
      },
    }
  `)

  // --- update mode (update: all) ---
  // Rewrite snapshots with current stable values
  result = await runVitest({ root, update: 'all' })
  expect(result.stderr).toMatchInlineSnapshot(`""`)
  expect(result.errorTree()).toMatchInlineSnapshot(`
    Object {
      "basic.test.ts": Object {
        "empty snapshot": "passed",
        "multiple poll snapshots": "passed",
        "non-poll alongside poll": "passed",
        "stable": "passed",
        "throw then stable": "passed",
        "unstable then stable": "passed",
      },
    }
  `)
  expect(readFileSync(snapshotFile, 'utf-8')).toMatchInlineSnapshot(`
    "// Vitest Snapshot v1, https://vitest.dev/guide/snapshot.html

    exports[\`empty snapshot 1\`] = \`\`;

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

    exports[\`throw then stable 1\`] = \`
    name=b
    age=23
    \`;

    exports[\`unstable then stable 1\`] = \`
    status=done
    \`;
    "
  `)

  // --- pattern-preserving update ---
  // Inject regex pattern into snapshot, verify --update preserves it
  editFile(snapshotFile, s => s
    .replace('name=a\n', 'name=/\\\\w/\n'))

  result = await runVitest({ root, update: 'all' })
  expect(result.stderr).toMatchInlineSnapshot(`""`)
  expect(result.errorTree()).toMatchInlineSnapshot(`
    Object {
      "basic.test.ts": Object {
        "empty snapshot": "passed",
        "multiple poll snapshots": "passed",
        "non-poll alongside poll": "passed",
        "stable": "passed",
        "throw then stable": "passed",
        "unstable then stable": "passed",
      },
    }
  `)
  expect(readFileSync(snapshotFile, 'utf-8')).toMatchInlineSnapshot(`
    "// Vitest Snapshot v1, https://vitest.dev/guide/snapshot.html

    exports[\`empty snapshot 1\`] = \`\`;

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
    name=/\\\\w/
    age=23
    \`;

    exports[\`throw then stable 1\`] = \`
    name=b
    age=23
    \`;

    exports[\`unstable then stable 1\`] = \`
    status=done
    \`;
    "
  `)
})

test('poll until stable match when "none"', async () => {
  const result = await runInlineTests({
    '__snapshots__/basic.test.ts.snap': `\
// Vitest Snapshot v1, https://vitest.dev/guide/snapshot.html

exports[\`stable wrong then right 1\`] = \`
phase=complete
\`;
`,
    'basic.test.ts': `
import { expect, test } from 'vitest'
import '../test/fixtures/domain/basic-extend'

test('stable wrong then right', async () => {
  let trial = 0
  await expect.poll(() => {
    trial++
    if (trial <= 4) return { phase: 'pending' }
    return { phase: 'complete' }
  }, { interval: 10 }).toMatchKvSnapshot()
  expect(trial).toBe(6)
})
`,
  }, {
    update: 'none',
  })
  expect(result.stderr).toMatchInlineSnapshot(`""`)
  expect(result.errorTree()).toMatchInlineSnapshot(`
    Object {
      "basic.test.ts": Object {
        "stable wrong then right": "passed",
      },
    }
  `)
})

test('poll until stable when "all"', async () => {
  const result = await runInlineTests({
    '__snapshots__/basic.test.ts.snap': `\
// Vitest Snapshot v1, https://vitest.dev/guide/snapshot.html

exports[\`stable wrong then right 1\`] = \`
phase=complete
\`;
`,
    'basic.test.ts': `
import { expect, test } from 'vitest'
import '../test/fixtures/domain/basic-extend'

test('stable wrong then right', async () => {
  let trial = 0
  await expect.poll(() => {
    trial++
    if (trial <= 4) return { phase: 'pending' }
    return { phase: 'complete' }
  }, { interval: 10 }).toMatchKvSnapshot()
  expect(trial).toBe(2)
})
`,
  }, {
    update: 'all',
  })
  expect(result.stderr).toMatchInlineSnapshot(`""`)
  expect(result.errorTree()).toMatchInlineSnapshot(`
    Object {
      "basic.test.ts": Object {
        "stable wrong then right": "passed",
      },
    }
  `)
  expect(result.fs.readFile('__snapshots__/basic.test.ts.snap')).toMatchInlineSnapshot(`
    "// Vitest Snapshot v1, https://vitest.dev/guide/snapshot.html

    exports[\`stable wrong then right 1\`] = \`
    phase=pending
    \`;
    "
  `)
})

test('errors', async () => {
  const result = await runInlineTests({
    'basic.test.ts': `
import { expect, test } from 'vitest'
import '../test/fixtures/domain/basic-extend'

test('unstable', async () => {
  let trial = 0
  await expect.poll(() => {
    trial++
    return { name: 'x', counter: String(trial) }
  }, { timeout: 100, interval: 10 }).toMatchKvSnapshot()
})

test('hanging', async () => {
  let trial = 0
  await expect.poll(() => {
    trial++
    return new Promise(() => {})
  }, { timeout: 100, interval: 10 }).toMatchKvSnapshot()
})

test('throwing', async () => {
  let trial = 0
  await expect.poll(() => {
    trial++
    throw new Error("ALWAYS_THROWS")
  }, { timeout: 100, interval: 10 }).toMatchKvSnapshot()
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
     ❯ basic.test.ts:10:38
          8|     trial++
          9|     return { name: 'x', counter: String(trial) }
         10|   }, { timeout: 100, interval: 10 }).toMatchKvSnapshot()
           |                                      ^
         11| })
         12|

    Caused by: Error: Matcher did not succeed in time.
     ❯ basic.test.ts:7:3

    ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/3]⎯

     FAIL  basic.test.ts > hanging
    Error: poll() did not produce a stable snapshot within the timeout
     ❯ basic.test.ts:18:38
         16|     trial++
         17|     return new Promise(() => {})
         18|   }, { timeout: 100, interval: 10 }).toMatchKvSnapshot()
           |                                      ^
         19| })
         20|

    Caused by: Error: Matcher did not succeed in time.
     ❯ basic.test.ts:15:3

    ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/3]⎯

     FAIL  basic.test.ts > throwing
    Error: ALWAYS_THROWS
     ❯ basic.test.ts:26:38
         24|     trial++
         25|     throw new Error("ALWAYS_THROWS")
         26|   }, { timeout: 100, interval: 10 }).toMatchKvSnapshot()
           |                                      ^
         27| })
         28|

    Caused by: Error: Matcher did not succeed in time.
     ❯ basic.test.ts:23:3

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
