import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, test } from 'vitest'
import { editFile, runInlineTests, runVitest } from '../../test-utils'
import { extractInlineSnaphsots } from './utils'

function readTestCases(file: string) {
  return extractInlineSnaphsots(readFileSync(file, 'utf-8'))
}

test('domain inline snapshot with poll', async () => {
  const root = join(import.meta.dirname, 'fixtures/domain-poll-inline')
  const testFile = join(root, 'basic.test.ts')

  // purge inline snapshots to empty strings
  editFile(testFile, s => s
    .replace(/toMatchKvInlineSnapshot\(`[^`]*`/g, 'toMatchKvInlineSnapshot('))

  // --- create snapshots (update: new) ---
  let result = await runVitest({ root, update: 'new' })
  expect(result.stderr).toMatchInlineSnapshot(`""`)
  expect(result.errorTree()).toMatchInlineSnapshot(`
    Object {
      "basic.test.ts": Object {
        "multiple poll snapshots": "passed",
        "non-poll alongside poll": "passed",
        "stable": "passed",
        "throw then stable": "passed",
        "unstable then stable": "passed",
      },
    }
  `)
  expect(readTestCases(testFile)).toMatchInlineSnapshot(`
    "
    expect.poll(() => {
        trial++
        return { name: 'a', age: '23' }
      }, { interval: 10 }).toMatchKvInlineSnapshot(\`
        name=a
        age=23
      \`)

    expect.poll(() => {
        trial++
        if (trial <= 3) {
          throw new Error(\`Fail at \${trial}\`)
        }
        return { name: 'b', age: '23' }
      }, { interval: 10 }).toMatchKvInlineSnapshot(\`
        name=b
        age=23
      \`)

    expect.poll(() => {
        trial++
        if (trial <= 3) return { status: 'loading', trial } // unstable
        return { status: 'done' } // then stable
      }, { interval: 10 }).toMatchKvInlineSnapshot(\`status=done\`)

    expect.poll(() => {
        return { x: '1' }
      }, { interval: 10 }).toMatchKvInlineSnapshot(\`x=1\`)

    expect.poll(() => {
        return { y: '2' }
      }, { interval: 10 }).toMatchKvInlineSnapshot(\`y=2\`)

    expect({ static: 'value' }).toMatchKvInlineSnapshot(\`static=value\`)

    expect.poll(() => {
        return { polled: 'value' }
      }, { interval: 10 }).toMatchKvInlineSnapshot(\`polled=value\`)

    expect({ another: 'static' }).toMatchKvInlineSnapshot(\`another=static\`)
    "
  `)

  // --- re-run unchanged (update: none) ---
  result = await runVitest({ root, update: 'none' })
  expect(result.stderr).toMatchInlineSnapshot(`""`)
  expect(result.errorTree()).toMatchInlineSnapshot(`
    Object {
      "basic.test.ts": Object {
        "multiple poll snapshots": "passed",
        "non-poll alongside poll": "passed",
        "stable": "passed",
        "throw then stable": "passed",
        "unstable then stable": "passed",
      },
    }
  `)

  // --- mismatch — stable on wrong value ---
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

     ❯ basic.test.ts:10:24
          8|     trial++
          9|     return { name: 'a', age: '23' }
         10|   }, { interval: 10 }).toMatchKvInlineSnapshot(\`
           |                        ^
         11|     name=a-changed
         12|     age=23

    Caused by: Error: Matcher did not succeed in time.
     ❯ basic.test.ts:7:3

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
        "throw then stable": "passed",
        "unstable then stable": "passed",
      },
    }
  `)

  // --- update mode (update: all) ---
  result = await runVitest({ root, update: 'all' })
  expect(result.stderr).toMatchInlineSnapshot(`""`)
  expect(result.errorTree()).toMatchInlineSnapshot(`
    Object {
      "basic.test.ts": Object {
        "multiple poll snapshots": "passed",
        "non-poll alongside poll": "passed",
        "stable": "passed",
        "throw then stable": "passed",
        "unstable then stable": "passed",
      },
    }
  `)
  expect(readTestCases(testFile)).toMatchInlineSnapshot(`
    "
    expect.poll(() => {
        trial++
        return { name: 'a', age: '23' }
      }, { interval: 10 }).toMatchKvInlineSnapshot(\`
        name=a
        age=23
      \`)

    expect.poll(() => {
        trial++
        if (trial <= 3) {
          throw new Error(\`Fail at \${trial}\`)
        }
        return { name: 'b', age: '23' }
      }, { interval: 10 }).toMatchKvInlineSnapshot(\`
        name=b
        age=23
      \`)

    expect.poll(() => {
        trial++
        if (trial <= 3) return { status: 'loading', trial } // unstable
        return { status: 'done' } // then stable
      }, { interval: 10 }).toMatchKvInlineSnapshot(\`status=done\`)

    expect.poll(() => {
        return { x: '1' }
      }, { interval: 10 }).toMatchKvInlineSnapshot(\`x=1\`)

    expect.poll(() => {
        return { y: '2' }
      }, { interval: 10 }).toMatchKvInlineSnapshot(\`y=2\`)

    expect({ static: 'value' }).toMatchKvInlineSnapshot(\`static=value\`)

    expect.poll(() => {
        return { polled: 'value' }
      }, { interval: 10 }).toMatchKvInlineSnapshot(\`polled=value\`)

    expect({ another: 'static' }).toMatchKvInlineSnapshot(\`another=static\`)
    "
  `)

  // --- pattern-preserving update ---
  editFile(testFile, s => s
    .replace('name=a\n', 'name=/\\\\w/\n'))

  result = await runVitest({ root, update: 'all' })
  expect(result.stderr).toMatchInlineSnapshot(`""`)
  expect(result.errorTree()).toMatchInlineSnapshot(`
    Object {
      "basic.test.ts": Object {
        "multiple poll snapshots": "passed",
        "non-poll alongside poll": "passed",
        "stable": "passed",
        "throw then stable": "passed",
        "unstable then stable": "passed",
      },
    }
  `)
  expect(readTestCases(testFile)).toMatchInlineSnapshot(`
    "
    expect.poll(() => {
        trial++
        return { name: 'a', age: '23' }
      }, { interval: 10 }).toMatchKvInlineSnapshot(\`
        name=/\\\\w/
        age=23
      \`)

    expect.poll(() => {
        trial++
        if (trial <= 3) {
          throw new Error(\`Fail at \${trial}\`)
        }
        return { name: 'b', age: '23' }
      }, { interval: 10 }).toMatchKvInlineSnapshot(\`
        name=b
        age=23
      \`)

    expect.poll(() => {
        trial++
        if (trial <= 3) return { status: 'loading', trial } // unstable
        return { status: 'done' } // then stable
      }, { interval: 10 }).toMatchKvInlineSnapshot(\`status=done\`)

    expect.poll(() => {
        return { x: '1' }
      }, { interval: 10 }).toMatchKvInlineSnapshot(\`x=1\`)

    expect.poll(() => {
        return { y: '2' }
      }, { interval: 10 }).toMatchKvInlineSnapshot(\`y=2\`)

    expect({ static: 'value' }).toMatchKvInlineSnapshot(\`static=value\`)

    expect.poll(() => {
        return { polled: 'value' }
      }, { interval: 10 }).toMatchKvInlineSnapshot(\`polled=value\`)

    expect({ another: 'static' }).toMatchKvInlineSnapshot(\`another=static\`)
    "
  `)
})

test('poll until stable match when "none"', async () => {
  const result = await runInlineTests({
    'basic.test.ts': `
import { expect, test } from 'vitest'
import '../test/fixtures/domain/basic-extend'

test('stable wrong then right', async () => {
  let trial = 0
  await expect.poll(() => {
    trial++
    if (trial <= 4) return { phase: 'pending' }
    return { phase: 'complete' }
  }, { interval: 10 }).toMatchKvInlineSnapshot(\`
    phase=complete
  \`)
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
    'basic.test.ts': `
import { expect, test } from 'vitest'
import '../test/fixtures/domain/basic-extend'

test('stable wrong then right', async () => {
  let trial = 0
  await expect.poll(() => {
    trial++
    if (trial <= 4) return { phase: 'pending' }
    return { phase: 'complete' }
  }, { interval: 10 }).toMatchKvInlineSnapshot(\`
    phase=complete
  \`)
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
  expect(result.fs.readFile('basic.test.ts')).toMatchInlineSnapshot(`
    "
    import { expect, test } from 'vitest'
    import '../test/fixtures/domain/basic-extend'

    test('stable wrong then right', async () => {
      let trial = 0
      await expect.poll(() => {
        trial++
        if (trial <= 4) return { phase: 'pending' }
        return { phase: 'complete' }
      }, { interval: 10 }).toMatchKvInlineSnapshot(\`phase=pending\`)
      expect(trial).toBe(2)
    })
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
  }, { timeout: 100, interval: 10 }).toMatchKvInlineSnapshot(\`\`)
})

test('hanging', async () => {
  let trial = 0
  await expect.poll(() => {
    trial++
    return new Promise(() => {})
  }, { timeout: 100, interval: 10 }).toMatchKvInlineSnapshot(\`\`)
})

test('throwing', async () => {
  let trial = 0
  await expect.poll(() => {
    trial++
    throw new Error("ALWAYS_THROWS")
  }, { timeout: 100, interval: 10 }).toMatchKvInlineSnapshot(\`\`)
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
         10|   }, { timeout: 100, interval: 10 }).toMatchKvInlineSnapshot(\`\`)
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
         18|   }, { timeout: 100, interval: 10 }).toMatchKvInlineSnapshot(\`\`)
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
         26|   }, { timeout: 100, interval: 10 }).toMatchKvInlineSnapshot(\`\`)
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
