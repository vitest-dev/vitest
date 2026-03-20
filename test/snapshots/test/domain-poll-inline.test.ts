import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, test } from 'vitest'
import { editFile, runInlineTests, runVitest } from '../../test-utils'

const SPLITTER = '// --- TEST CASES ---'

function readTestCases(file: string) {
  return readFileSync(file, 'utf-8').split(SPLITTER)[1]
}

test('domain inline snapshot with poll', async () => {
  const root = join(import.meta.dirname, 'fixtures/domain-poll-inline')
  const testFile = join(root, 'basic.test.ts')

  // purge inline snapshots to empty strings
  editFile(testFile, s => s
    .replace(/toMatchDomainInlineSnapshot\(`[^`]*`/g, 'toMatchDomainInlineSnapshot(``'))

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
    test('stable', async () => {
      let trial = 0
      await expect.poll(() => {
        trial++
        return { name: 'a', age: '23' }
      }, { interval: 10 }).toMatchDomainInlineSnapshot(\`
        name=a
        age=23
      \`, 'kv')
      expect(trial).toBe(2)
    })

    test('throw then stable', async () => {
      let trial = 0
      await expect.poll(() => {
        trial++
        if (trial <= 3) {
          throw new Error(\`Fail at \${trial}\`)
        }
        return { name: 'b', age: '23' }
      }, { interval: 10 }).toMatchDomainInlineSnapshot(\`
        name=b
        age=23
      \`, 'kv')
      expect(trial).toBe(5)
    })

    test('unstable then stable', async () => {
      let trial = 0
      await expect.poll(() => {
        trial++
        if (trial <= 3) return { status: 'loading', trial } // unstable
        return { status: 'done' } // then stable
      }, { interval: 10 }).toMatchDomainInlineSnapshot(\`status=done\`, 'kv')
      expect(trial).toBe(5)
    })

    test('multiple poll snapshots', async () => {
      await expect.poll(() => {
        return { x: '1' }
      }, { interval: 10 }).toMatchDomainInlineSnapshot(\`x=1\`, 'kv')

      await expect.poll(() => {
        return { y: '2' }
      }, { interval: 10 }).toMatchDomainInlineSnapshot(\`y=2\`, 'kv')
    })

    test('non-poll alongside poll', async () => {
      expect({ static: 'value' }).toMatchDomainInlineSnapshot(\`static=value\`, 'kv')

      await expect.poll(() => {
        return { polled: 'value' }
      }, { interval: 10 }).toMatchDomainInlineSnapshot(\`polled=value\`, 'kv')

      expect({ another: 'static' }).toMatchDomainInlineSnapshot(\`another=static\`, 'kv')
    })
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

     ❯ basic.test.ts:12:24
         10|     trial++
         11|     return { name: 'a', age: '23' }
         12|   }, { interval: 10 }).toMatchDomainInlineSnapshot(\`
           |                        ^
         13|     name=a-changed
         14|     age=23

    Caused by: Error: Matcher did not succeed in time.
     ❯ basic.test.ts:9:3

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
    test('stable', async () => {
      let trial = 0
      await expect.poll(() => {
        trial++
        return { name: 'a', age: '23' }
      }, { interval: 10 }).toMatchDomainInlineSnapshot(\`
        name=a
        age=23
      \`, 'kv')
      expect(trial).toBe(2)
    })

    test('throw then stable', async () => {
      let trial = 0
      await expect.poll(() => {
        trial++
        if (trial <= 3) {
          throw new Error(\`Fail at \${trial}\`)
        }
        return { name: 'b', age: '23' }
      }, { interval: 10 }).toMatchDomainInlineSnapshot(\`
        name=b
        age=23
      \`, 'kv')
      expect(trial).toBe(5)
    })

    test('unstable then stable', async () => {
      let trial = 0
      await expect.poll(() => {
        trial++
        if (trial <= 3) return { status: 'loading', trial } // unstable
        return { status: 'done' } // then stable
      }, { interval: 10 }).toMatchDomainInlineSnapshot(\`status=done\`, 'kv')
      expect(trial).toBe(5)
    })

    test('multiple poll snapshots', async () => {
      await expect.poll(() => {
        return { x: '1' }
      }, { interval: 10 }).toMatchDomainInlineSnapshot(\`x=1\`, 'kv')

      await expect.poll(() => {
        return { y: '2' }
      }, { interval: 10 }).toMatchDomainInlineSnapshot(\`y=2\`, 'kv')
    })

    test('non-poll alongside poll', async () => {
      expect({ static: 'value' }).toMatchDomainInlineSnapshot(\`static=value\`, 'kv')

      await expect.poll(() => {
        return { polled: 'value' }
      }, { interval: 10 }).toMatchDomainInlineSnapshot(\`polled=value\`, 'kv')

      expect({ another: 'static' }).toMatchDomainInlineSnapshot(\`another=static\`, 'kv')
    })
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
    test('stable', async () => {
      let trial = 0
      await expect.poll(() => {
        trial++
        return { name: 'a', age: '23' }
      }, { interval: 10 }).toMatchDomainInlineSnapshot(\`
        name=/\\\\w/
        age=23
      \`, 'kv')
      expect(trial).toBe(2)
    })

    test('throw then stable', async () => {
      let trial = 0
      await expect.poll(() => {
        trial++
        if (trial <= 3) {
          throw new Error(\`Fail at \${trial}\`)
        }
        return { name: 'b', age: '23' }
      }, { interval: 10 }).toMatchDomainInlineSnapshot(\`
        name=b
        age=23
      \`, 'kv')
      expect(trial).toBe(5)
    })

    test('unstable then stable', async () => {
      let trial = 0
      await expect.poll(() => {
        trial++
        if (trial <= 3) return { status: 'loading', trial } // unstable
        return { status: 'done' } // then stable
      }, { interval: 10 }).toMatchDomainInlineSnapshot(\`status=done\`, 'kv')
      expect(trial).toBe(5)
    })

    test('multiple poll snapshots', async () => {
      await expect.poll(() => {
        return { x: '1' }
      }, { interval: 10 }).toMatchDomainInlineSnapshot(\`x=1\`, 'kv')

      await expect.poll(() => {
        return { y: '2' }
      }, { interval: 10 }).toMatchDomainInlineSnapshot(\`y=2\`, 'kv')
    })

    test('non-poll alongside poll', async () => {
      expect({ static: 'value' }).toMatchDomainInlineSnapshot(\`static=value\`, 'kv')

      await expect.poll(() => {
        return { polled: 'value' }
      }, { interval: 10 }).toMatchDomainInlineSnapshot(\`polled=value\`, 'kv')

      expect({ another: 'static' }).toMatchDomainInlineSnapshot(\`another=static\`, 'kv')
    })
    "
  `)
})

test('poll until stable match when "none"', async () => {
  const result = await runInlineTests({
    'basic.test.ts': `
import { expect, test } from 'vitest'
import { kvAdapter } from '../test/fixtures/domain/basic'

expect.addSnapshotDomain(kvAdapter)

test('stable wrong then right', async () => {
  let trial = 0
  await expect.poll(() => {
    trial++
    if (trial <= 4) return { phase: 'pending' }
    return { phase: 'complete' }
  }, { interval: 10 }).toMatchDomainInlineSnapshot(\`
    phase=complete
  \`, 'kv')
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
import { kvAdapter } from '../test/fixtures/domain/basic'

expect.addSnapshotDomain(kvAdapter)

test('stable wrong then right', async () => {
  let trial = 0
  await expect.poll(() => {
    trial++
    if (trial <= 4) return { phase: 'pending' }
    return { phase: 'complete' }
  }, { interval: 10 }).toMatchDomainInlineSnapshot(\`
    phase=complete
  \`, 'kv')
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
    import { kvAdapter } from '../test/fixtures/domain/basic'

    expect.addSnapshotDomain(kvAdapter)

    test('stable wrong then right', async () => {
      let trial = 0
      await expect.poll(() => {
        trial++
        if (trial <= 4) return { phase: 'pending' }
        return { phase: 'complete' }
      }, { interval: 10 }).toMatchDomainInlineSnapshot(\`phase=pending\`, 'kv')
      expect(trial).toBe(2)
    })
    "
  `)
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
  }, { timeout: 100, interval: 10 }).toMatchDomainInlineSnapshot(\`\`, 'kv')
})

test('hanging', async () => {
  let trial = 0
  await expect.poll(() => {
    trial++
    return new Promise(() => {})
  }, { timeout: 100, interval: 10 }).toMatchDomainInlineSnapshot(\`\`, 'kv')
})

test('throwing', async () => {
  let trial = 0
  await expect.poll(() => {
    trial++
    throw new Error("ALWAYS_THROWS")
  }, { timeout: 100, interval: 10 }).toMatchDomainInlineSnapshot(\`\`, 'kv')
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
         12|   }, { timeout: 100, interval: 10 }).toMatchDomainInlineSnapshot(\`\`, '…
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
         20|   }, { timeout: 100, interval: 10 }).toMatchDomainInlineSnapshot(\`\`, '…
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
         28|   }, { timeout: 100, interval: 10 }).toMatchDomainInlineSnapshot(\`\`, '…
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
