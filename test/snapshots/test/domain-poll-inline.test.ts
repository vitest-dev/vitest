import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, test } from 'vitest'
import { editFile, runVitest } from '../../test-utils'

const SPLITTER = '// --- TEST CASES ---'

function readTestCases(file: string) {
  return readFileSync(file, 'utf-8').split(SPLITTER)[1]
}

// TODO: inline version of test/snapshots/test/domain-poll.test.ts
test('domain inline snapshot with poll', async () => {
  const root = join(import.meta.dirname, 'fixtures/domain-poll-inline')
  const testFile = join(root, 'basic.test.ts')

  // purge inline snapshots to empty strings
  editFile(testFile, s => s
    .replace(/toMatchDomainInlineSnapshot\(`[^`]*`/g, 'toMatchDomainInlineSnapshot(``'))

  // create snapshots from scratch
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
  expect(readTestCases(testFile)).toMatchInlineSnapshot(`
    "
    test('stable', async () => {
      let trial = 0
      await expect.poll(() => {
        trial++;
        // --- STABLE TEST POLL ---
        return { name: 'a', age: '23' }
      }, { timeout: 100 }).toMatchDomainInlineSnapshot(\`
        name=a
        age=23
      \`, 'kv')
      expect(trial).toBe(1)
    })

    test('throw then stable', async () => {
      let trial = 0
      await expect.poll(() => {
        trial++
        if (trial <= 1) {
          throw new Error(\`Fail at \${trial}\`)
        }
        return { name: 'b', age: '23' }
      }).toMatchDomainInlineSnapshot(\`
        name=b
        age=23
      \`, 'kv')
      expect(trial).toBe(2)
    })

    test('unstable', async () => {
      let trial = 0
      await expect.poll(() => {
        trial++
        return { name: 'c', __UNSTABLE_TRIAL__: trial }
      }).toMatchDomainInlineSnapshot(\`
        name=c
        __UNSTABLE_TRIAL__=1
      \`, 'kv')
    })
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

  // unstable passes on 3rd try — edit inline snapshot
  editFile(testFile, s => s
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

  // update rewrites inline snapshots with first successful poll value
  editFile(testFile, s => s
    .replace('name=b', 'name=b-changed'))

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
  // unstable reverts to trial=1 (first successful poll value), name=b restored
  expect(readTestCases(testFile)).toMatchInlineSnapshot(`
    "
    test('stable', async () => {
      let trial = 0
      await expect.poll(() => {
        trial++;
        // --- STABLE TEST POLL ---
        return { name: 'a', age: '23' }
      }, { timeout: 100 }).toMatchDomainInlineSnapshot(\`
        name=a
        age=23
      \`, 'kv')
      expect(trial).toBe(1)
    })

    test('throw then stable', async () => {
      let trial = 0
      await expect.poll(() => {
        trial++
        if (trial <= 1) {
          throw new Error(\`Fail at \${trial}\`)
        }
        return { name: 'b', age: '23' }
      }).toMatchDomainInlineSnapshot(\`
        name=b
        age=23
      \`, 'kv')
      expect(trial).toBe(2)
    })

    test('unstable', async () => {
      let trial = 0
      await expect.poll(() => {
        trial++
        return { name: 'c', __UNSTABLE_TRIAL__: trial }
      }).toMatchDomainInlineSnapshot(\`
        name=c
        __UNSTABLE_TRIAL__=1
      \`, 'kv')
    })
    "
  `)

  // mismatch all retries — stable test never matches
  editFile(testFile, s => s
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

     ❯ basic.test.ts:13:24
         11|     // --- STABLE TEST POLL ---
         12|     return { name: 'a', age: '23' }
         13|   }, { timeout: 100 }).toMatchDomainInlineSnapshot(\`
           |                        ^
         14|     name=a-changed
         15|     age=23

    Caused by: Error: Matcher did not succeed in time.
     ❯ basic.test.ts:9:3

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

  // throws all retries — poll always throws
  editFile(testFile, s => s
    .replace('name=a-changed\n', 'name=a\n')
    .replace('// --- STABLE TEST POLL ---', 'throw new Error("STABLE TEST ERROR")'))

  result = await runVitest({ root, update: 'none' })
  expect(result.stderr).toMatchInlineSnapshot(`
    "
    ⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

     FAIL  basic.test.ts > stable
    Error: STABLE TEST ERROR
     ❯ basic.test.ts:13:24
         11|     throw new Error("STABLE TEST ERROR")
         12|     return { name: 'a', age: '23' }
         13|   }, { timeout: 100 }).toMatchDomainInlineSnapshot(\`
           |                        ^
         14|     name=a
         15|     age=23

    Caused by: Error: Matcher did not succeed in time.
     ❯ basic.test.ts:9:3

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
     ❯ basic.test.ts:13:24
         11|     return new Promise(r => setTimeout(r, 1000))
         12|     return { name: 'a', age: '23' }
         13|   }, { timeout: 100 }).toMatchDomainInlineSnapshot(\`
           |                        ^
         14|     name=a
         15|     age=23

    Caused by: Error: Matcher did not succeed in time.
     ❯ basic.test.ts:9:3

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

  // pattern-preserving update — hand-edit regex into inline snapshot,
  //    run --update, verify mergedExpected preserves matched patterns
  editFile(testFile, s => s
    .replace(`return new Promise(r => setTimeout(r, 1000))`, '// --- STABLE TEST POLL ---')
    .replace('name=a\n', 'name=/\\\\w/\n'))

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
  expect(readTestCases(testFile)).toMatchInlineSnapshot(`
    "
    test('stable', async () => {
      let trial = 0
      await expect.poll(() => {
        trial++;
        // --- STABLE TEST POLL ---
        return { name: 'a', age: '23' }
      }, { timeout: 100 }).toMatchDomainInlineSnapshot(\`
        name=/\\\\w/
        age=23
      \`, 'kv')
      expect(trial).toBe(1)
    })

    test('throw then stable', async () => {
      let trial = 0
      await expect.poll(() => {
        trial++
        if (trial <= 1) {
          throw new Error(\`Fail at \${trial}\`)
        }
        return { name: 'b', age: '23' }
      }).toMatchDomainInlineSnapshot(\`
        name=b
        age=23
      \`, 'kv')
      expect(trial).toBe(2)
    })

    test('unstable', async () => {
      let trial = 0
      await expect.poll(() => {
        trial++
        return { name: 'c', __UNSTABLE_TRIAL__: trial }
      }).toMatchDomainInlineSnapshot(\`
        name=c
        __UNSTABLE_TRIAL__=1
      \`, 'kv')
    })
    "
  `)
})
