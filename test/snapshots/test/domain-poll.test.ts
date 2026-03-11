import fs, { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, test } from 'vitest'
import { editFile, runVitest } from '../../test-utils'

test('domain snapshot with poll', async () => {
  const root = join(import.meta.dirname, 'fixtures/domain-poll')
  const snapshotFile = join(root, '__snapshots__/basic.test.ts.snap')

  // clean slate
  fs.rmSync(join(root, '__snapshots__'), { recursive: true, force: true })

  // 1. create snapshots (update: "new")
  //    - "poll retries until value available": poll() throws first, then succeeds
  //    - "stable value": poll() returns stable value immediately
  //    - "settling value": poll() returns intermediate value on first run (no match retry on create)
  let result = await runVitest({ root, update: 'new' })
  expect(result.stderr).toMatchInlineSnapshot(`""`)
  expect(result.errorTree()).toMatchInlineSnapshot(`
    Object {
      "basic.test.ts": Object {
        "poll retries until value available": "passed",
        "settling value": "passed",
        "stable value": "passed",
      },
    }
  `)
  expect(readFileSync(snapshotFile, 'utf-8')).toMatchInlineSnapshot(`
    "// Vitest Snapshot v1, https://vitest.dev/guide/snapshot.html

    exports[\`poll retries until value available 1\`] = \`
    name=alice
    age=30
    \`;

    exports[\`settling value 1\`] = \`
    city=loading
    pop=0
    \`;

    exports[\`stable value 1\`] = \`
    name=bob
    score=999
    status=active
    \`;
    "
  `)

  // 2. re-run (update: "none") — all pass because stored snapshot matches
  //    what poll() returns on first successful call
  result = await runVitest({ root, update: 'none' })
  expect(result.stderr).toMatchInlineSnapshot(`""`)
  expect(result.errorTree()).toMatchInlineSnapshot(`
    Object {
      "basic.test.ts": Object {
        "poll retries until value available": "passed",
        "settling value": "passed",
        "stable value": "passed",
      },
    }
  `)

  // 3. seed "settling value" snapshot with the FINAL value.
  //    Now poll() returns intermediates first, but retry loop should keep probing
  //    until poll() returns the value that matches the stored snapshot.
  editFile(snapshotFile, s => s
    .replace('city=loading', 'city=tokyo')
    .replace('pop=0', 'pop=14000000'))

  // 4. re-run (update: "none") — poll() returns intermediates first,
  //    retry loop keeps probing, eventually poll() returns final value that matches
  result = await runVitest({ root, update: 'none' })
  expect(result.stderr).toMatchInlineSnapshot(`""`)
  expect(result.errorTree()).toMatchInlineSnapshot(`
    Object {
      "basic.test.ts": Object {
        "poll retries until value available": "passed",
        "settling value": "passed",
        "stable value": "passed",
      },
    }
  `)

  // 5. update (update: "all") — captures first successful value, no match retry
  result = await runVitest({ root, update: 'all' })
  expect(result.stderr).toMatchInlineSnapshot(`""`)
  expect(result.errorTree()).toMatchInlineSnapshot(`
    Object {
      "basic.test.ts": Object {
        "poll retries until value available": "passed",
        "settling value": "passed",
        "stable value": "passed",
      },
    }
  `)
  expect(readFileSync(snapshotFile, 'utf-8')).toMatchInlineSnapshot(`
    "// Vitest Snapshot v1, https://vitest.dev/guide/snapshot.html

    exports[\`poll retries until value available 1\`] = \`
    name=alice
    age=30
    \`;

    exports[\`settling value 1\`] = \`
    city=loading
    pop=0
    \`;

    exports[\`stable value 1\`] = \`
    name=bob
    score=999
    status=active
    \`;
    "
  `)
})
