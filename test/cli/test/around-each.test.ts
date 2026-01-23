import { expect, test } from 'vitest'
import { runInlineTests } from '../../test-utils'

test('basic aroundEach wraps the test', async () => {
  const { stdout, stderr } = await runInlineTests({
    'basic.test.ts': `
      import { aroundEach, test } from 'vitest'

      aroundEach(async (runTest) => {
        console.log('>> before test')
        await runTest()
        console.log('>> after test')
      })

      test('test 1', () => {
        console.log('>> inside test')
      })
    `,
  })

  expect(stderr).toBe('')
  expect(stdout).toContain('>> before test')
  expect(stdout).toContain('>> inside test')
  expect(stdout).toContain('>> after test')

  // Verify order
  const beforeIndex = stdout.indexOf('>> before test')
  const insideIndex = stdout.indexOf('>> inside test')
  const afterIndex = stdout.indexOf('>> after test')
  expect(beforeIndex).toBeLessThan(insideIndex)
  expect(insideIndex).toBeLessThan(afterIndex)
})

test('multiple aroundEach hooks are nested (first is outermost)', async () => {
  const { stdout, stderr } = await runInlineTests({
    'nested-hooks.test.ts': `
      import { aroundEach, test } from 'vitest'

      aroundEach(async (runTest) => {
        console.log('>> outer before')
        await runTest()
        console.log('>> outer after')
      })

      aroundEach(async (runTest) => {
        console.log('>> inner before')
        await runTest()
        console.log('>> inner after')
      })

      test('test 1', () => {
        console.log('>> test')
      })
    `,
  })

  expect(stderr).toBe('')

  // Extract log lines
  const logs = stdout.split('\n').filter(line => line.startsWith('>> ')).map(l => l.trim())
  expect(logs).toEqual([
    '>> outer before',
    '>> inner before',
    '>> test',
    '>> inner after',
    '>> outer after',
  ])
})

test('aroundEach in nested suites wraps correctly', async () => {
  const { stdout, stderr } = await runInlineTests({
    'nested-suites.test.ts': `
      import { aroundEach, describe, test } from 'vitest'

      aroundEach(async (runTest) => {
        console.log('>> root before')
        await runTest()
        console.log('>> root after')
      })

      describe('suite 1', () => {
        aroundEach(async (runTest) => {
          console.log('>> suite1 before')
          await runTest()
          console.log('>> suite1 after')
        })

        test('test in suite 1', () => {
          console.log('>> test suite1')
        })

        describe('nested suite', () => {
          aroundEach(async (runTest) => {
            console.log('>> nested before')
            await runTest()
            console.log('>> nested after')
          })

          test('test in nested suite', () => {
            console.log('>> test nested')
          })
        })
      })
    `,
  })

  expect(stderr).toBe('')

  // Check that suite 1 test has root and suite1 hooks
  const suite1TestLogs = stdout.substring(
    stdout.indexOf('>> root before'),
    stdout.indexOf('>> root after') + '>> root after'.length,
  )
  expect(suite1TestLogs).toContain('>> root before')
  expect(suite1TestLogs).toContain('>> suite1 before')
  expect(suite1TestLogs).toContain('>> test suite1')
})

test('throws error when runTest is not called', async () => {
  const { stderr } = await runInlineTests({
    'no-runtest.test.ts': `
      import { aroundEach, test } from 'vitest'

      aroundEach(async (_runTest) => {
        console.log('>> aroundEach without calling runTest')
        // Not calling runTest()
      })

      test('test 1', () => {
        console.log('>> test should not run')
      })
    `,
  })

  expect(stderr).toContain('The `runTest()` callback was not called in the `aroundEach` hook')
})

test('aroundEach with async operations', async () => {
  const { stdout, stderr, errorTree } = await runInlineTests({
    'async.test.ts': `
      import { aroundEach, test } from 'vitest'

      aroundEach(async (runTest) => {
        console.log('>> setup start')
        await new Promise(r => setTimeout(r, 10))
        console.log('>> setup done')
        await runTest()
        console.log('>> cleanup start')
        await new Promise(r => setTimeout(r, 10))
        console.log('>> cleanup done')
      })

      test('async test', async () => {
        console.log('>> test running')
        await new Promise(r => setTimeout(r, 10))
        console.log('>> test done')
      })
    `,
  })

  expect(stderr).toBe('')
  expect(errorTree()).toMatchInlineSnapshot(`
    {
      "async.test.ts": {
        "async test": "passed",
      },
    }
  `)

  const logs = stdout.split('\n').filter(line => line.startsWith('>> ')).map(l => l.trim())
  expect(logs).toEqual([
    '>> setup start',
    '>> setup done',
    '>> test running',
    '>> test done',
    '>> cleanup start',
    '>> cleanup done',
  ])
})

test('aroundEach runs for each test', async () => {
  const { stdout, stderr } = await runInlineTests({
    'each-test.test.ts': `
      import { aroundEach, test } from 'vitest'

      let counter = 0

      aroundEach(async (runTest) => {
        counter++
        console.log('>> aroundEach run ' + counter)
        await runTest()
      })

      test('test 1', () => {
        console.log('>> test 1')
      })

      test('test 2', () => {
        console.log('>> test 2')
      })

      test('test 3', () => {
        console.log('>> test 3')
      })
    `,
  })

  expect(stderr).toBe('')
  expect(stdout).toContain('>> aroundEach run 1')
  expect(stdout).toContain('>> aroundEach run 2')
  expect(stdout).toContain('>> aroundEach run 3')
})

test('aroundEach with beforeEach and afterEach', async () => {
  const { stdout, stderr } = await runInlineTests({
    'with-hooks.test.ts': `
      import { aroundEach, beforeEach, afterEach, test } from 'vitest'

      beforeEach(() => {
        console.log('>> beforeEach')
      })

      aroundEach(async (runTest) => {
        console.log('>> aroundEach before')
        await runTest()
        console.log('>> aroundEach after')
      })

      afterEach(() => {
        console.log('>> afterEach')
      })

      test('test 1', () => {
        console.log('>> test')
      })
    `,
  })

  expect(stderr).toBe('')

  // aroundEach should wrap around beforeEach/test/afterEach
  const logs = stdout.split('\n').filter(line => line.startsWith('>> ')).map(l => l.trim())
  expect(logs).toEqual([
    '>> aroundEach before',
    '>> beforeEach',
    '>> test',
    '>> afterEach',
    '>> aroundEach after',
  ])
})

test('aroundEach receives test context', async () => {
  const { stdout, stderr, errorTree } = await runInlineTests({
    'context.test.ts': `
      import { aroundEach, test, expect } from 'vitest'

      aroundEach(async (runTest, context) => {
        console.log('>> test name:', context.task.name)
        await runTest()
      })

      test('my test name', () => {
        console.log('>> inside test')
      })
    `,
  })

  expect(stderr).toBe('')
  expect(stdout).toContain('>> test name: my test name')
  expect(errorTree()).toMatchInlineSnapshot(`
    {
      "context.test.ts": {
        "my test name": "passed",
      },
    }
  `)
})

test('aroundEach cleanup runs even on test failure', async () => {
  const { stdout, stderr, errorTree } = await runInlineTests({
    'test-failure.test.ts': `
      import { aroundEach, test, expect } from 'vitest'

      aroundEach(async (runTest) => {
        console.log('>> setup')
        await runTest()
        console.log('>> cleanup (should run)')
      })

      test('failing test', () => {
        console.log('>> test running')
        expect(1).toBe(2) // This will fail
      })
    `,
  })

  // Cleanup should still run even when test fails
  expect(stderr).toContain('expected 1 to be 2')
  expect(stdout).toContain('>> setup')
  expect(stdout).toContain('>> test running')
  expect(stdout).toContain('>> cleanup (should run)')
  expect(errorTree()).toMatchInlineSnapshot(`
    {
      "test-failure.test.ts": {
        "failing test": [
          "expected 1 to be 2 // Object.is equality",
        ],
      },
    }
  `)
})

test('aroundEach error prevents test from running', async () => {
  const { stdout, stderr } = await runInlineTests({
    'hook-error.test.ts': `
      import { aroundEach, test } from 'vitest'

      aroundEach(async (runTest) => {
        console.log('>> before error')
        throw new Error('aroundEach error')
        await runTest() // unreachable
      })

      test('test 1', () => {
        console.log('>> test should not run')
      })
    `,
  })

  expect(stderr).toMatchInlineSnapshot(`
    "
    ⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

     FAIL  hook-error.test.ts > test 1
    Error: aroundEach error
     ❯ hook-error.test.ts:6:15
          4|       aroundEach(async (runTest) => {
          5|         console.log('>> before error')
          6|         throw new Error('aroundEach error')
           |               ^
          7|         await runTest() // unreachable
          8|       })

    ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯

    "
  `)
  expect(stdout).toContain('>> before error')
  expect(stdout).not.toContain('>> test should not run')
})

test('aroundEach cleanup error is reported', async () => {
  const { stdout, stderr } = await runInlineTests({
    'cleanup-error.test.ts': `
      import { aroundEach, test } from 'vitest'

      aroundEach(async (runTest) => {
        console.log('>> setup')
        await runTest()
        console.log('>> cleanup before error')
        throw new Error('cleanup error')
      })

      test('test 1', () => {
        console.log('>> test ran')
      })
    `,
  })

  expect(stdout).toContain('>> setup')
  expect(stdout).toContain('>> test ran')
  expect(stdout).toContain('>> cleanup before error')
  expect(stderr).toMatchInlineSnapshot(`
    "
    ⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

     FAIL  cleanup-error.test.ts > test 1
    Error: cleanup error
     ❯ cleanup-error.test.ts:8:15
          6|         await runTest()
          7|         console.log('>> cleanup before error')
          8|         throw new Error('cleanup error')
           |               ^
          9|       })
         10| 

    ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯

    "
  `)
})

test('aroundEach with database transaction pattern', async () => {
  const { stderr, errorTree } = await runInlineTests({
    'transaction.test.ts': `
      import { aroundEach, test, expect } from 'vitest'

      // Simulating a database transaction pattern
      const db = {
        data: [] as string[],
        inTransaction: false,
        beginTransaction() {
          this.inTransaction = true
          console.log('>> BEGIN TRANSACTION')
        },
        commit() {
          this.inTransaction = false
          console.log('>> COMMIT')
        },
        rollback() {
          this.data = []
          this.inTransaction = false
          console.log('>> ROLLBACK')
        },
        insert(value: string) {
          if (!this.inTransaction) throw new Error('Not in transaction')
          this.data.push(value)
          console.log('>> INSERT:', value)
        }
      }

      aroundEach(async (runTest) => {
        db.beginTransaction()
        try {
          await runTest()
        } finally {
          db.rollback() // Always rollback to keep tests isolated
        }
      })

      test('insert data', () => {
        db.insert('test1')
        expect(db.data).toContain('test1')
      })

      test('data is rolled back', () => {
        expect(db.data).toEqual([]) // Previous test's data was rolled back
        db.insert('test2')
        expect(db.data).toContain('test2')
      })
    `,
  })

  expect(stderr).toBe('')
  expect(errorTree()).toMatchInlineSnapshot(`
    {
      "transaction.test.ts": {
        "data is rolled back": "passed",
        "insert data": "passed",
      },
    }
  `)
})

test('aroundEach with globals: true', async () => {
  const { stdout, stderr, errorTree } = await runInlineTests({
    'globals.test.ts': `
      aroundEach(async (runTest) => {
        console.log('>> aroundEach global')
        await runTest()
        console.log('>> aroundEach global done')
      })

      test('test with globals', () => {
        console.log('>> test')
      })
    `,
  }, { globals: true })

  expect(stderr).toBe('')
  expect(stdout).toContain('>> aroundEach global')
  expect(stdout).toContain('>> test')
  expect(stdout).toContain('>> aroundEach global done')
  expect(errorTree()).toMatchInlineSnapshot(`
    {
      "globals.test.ts": {
        "test with globals": "passed",
      },
    }
  `)
})

test('aroundEach with test.each', async () => {
  const { stdout, stderr, errorTree } = await runInlineTests({
    'test-each.test.ts': `
      import { aroundEach, test } from 'vitest'

      aroundEach(async (runTest, context) => {
        console.log('>> aroundEach for:', context.task.name)
        await runTest()
      })

      test.each([1, 2, 3])('test %i', (num) => {
        console.log('>> test value:', num)
      })
    `,
  })

  expect(stderr).toBe('')
  expect(stdout).toContain('>> aroundEach for: test 1')
  expect(stdout).toContain('>> aroundEach for: test 2')
  expect(stdout).toContain('>> aroundEach for: test 3')
  expect(errorTree()).toMatchInlineSnapshot(`
    {
      "test-each.test.ts": {
        "test 1": "passed",
        "test 2": "passed",
        "test 3": "passed",
      },
    }
  `)
})

test('aroundEach with concurrent tests', async () => {
  const { stderr, errorTree } = await runInlineTests({
    'concurrent.test.ts': `
      import { aroundEach, describe, test } from 'vitest'

      const logs: string[] = []

      aroundEach(async (runTest, context) => {
        logs.push('start ' + context.task.name)
        await runTest()
        logs.push('end ' + context.task.name)
      })

      describe('concurrent suite', { concurrent: true }, () => {
        test('test 1', async () => {
          await new Promise(r => setTimeout(r, 50))
        })

        test('test 2', async () => {
          await new Promise(r => setTimeout(r, 30))
        })

        test('test 3', async () => {
          await new Promise(r => setTimeout(r, 10))
        })
      })
    `,
  })

  expect(stderr).toBe('')
  expect(errorTree()).toMatchInlineSnapshot(`
    {
      "concurrent.test.ts": {
        "concurrent suite": {
          "test 1": "passed",
          "test 2": "passed",
          "test 3": "passed",
        },
      },
    }
  `)
})

test('aroundEach with retry', async () => {
  const { stdout, stderr, errorTree } = await runInlineTests({
    'retry.test.ts': `
      import { aroundEach, test, expect } from 'vitest'

      let attempt = 0

      aroundEach(async (runTest) => {
        attempt++
        console.log('>> aroundEach attempt:', attempt)
        await runTest()
      })

      test('retried test', { retry: 2 }, () => {
        console.log('>> test attempt:', attempt)
        if (attempt < 3) {
          throw new Error('fail on purpose')
        }
      })
    `,
  })

  expect(stderr).toBe('')
  expect(stdout).toContain('>> aroundEach attempt: 1')
  expect(stdout).toContain('>> aroundEach attempt: 2')
  expect(stdout).toContain('>> aroundEach attempt: 3')
  expect(errorTree()).toMatchInlineSnapshot(`
    {
      "retry.test.ts": {
        "retried test": "passed",
      },
    }
  `)
})

test('aroundEach receives suite as third argument', async () => {
  const { stdout, stderr, errorTree } = await runInlineTests({
    'suite-arg.test.ts': `
      import { aroundEach, describe, test } from 'vitest'

      describe('my suite', () => {
        aroundEach(async (runTest, _context, suite) => {
          console.log('>> suite name:', suite.name)
          await runTest()
        })

        test('test 1', () => {
          console.log('>> test')
        })
      })
    `,
  })

  expect(stderr).toBe('')
  expect(stdout).toContain('>> suite name: my suite')
  expect(errorTree()).toMatchInlineSnapshot(`
    {
      "suite-arg.test.ts": {
        "my suite": {
          "test 1": "passed",
        },
      },
    }
  `)
})

test('aroundEach skipped when test is skipped', async () => {
  const { stdout, stderr, errorTree } = await runInlineTests({
    'skipped.test.ts': `
      import { aroundEach, test } from 'vitest'

      aroundEach(async (runTest, context) => {
        console.log('>> aroundEach for:', context.task.name)
        await runTest()
      })

      test('normal test', () => {
        console.log('>> normal test')
      })

      test.skip('skipped test', () => {
        console.log('>> skipped test')
      })
    `,
  })

  expect(stderr).toBe('')
  expect(stdout).toContain('>> aroundEach for: normal test')
  expect(stdout).not.toContain('>> aroundEach for: skipped test')
  expect(stdout).not.toContain('>> skipped test')
  expect(errorTree()).toMatchInlineSnapshot(`
    {
      "skipped.test.ts": {
        "normal test": "passed",
        "skipped test": "skipped",
      },
    }
  `)
})

test('aroundEach setup phase timeout', async () => {
  const { stderr } = await runInlineTests({
    'setup-timeout.test.ts': `
      import { aroundEach, test } from 'vitest'

      aroundEach(async (runTest) => {
        console.log('>> setup start')
        // Simulate slow setup
        await new Promise(r => setTimeout(r, 5000))
        console.log('>> setup end (should not reach)')
        await runTest()
        console.log('>> teardown')
      }, 100) // 100ms timeout

      test('test with slow setup', () => {
        console.log('>> test (should not run)')
      })
    `,
  })

  expect(stderr).toMatchInlineSnapshot(`
    "
    ⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

     FAIL  setup-timeout.test.ts > test with slow setup
    Error: The setup phase of "aroundEach" hook timed out after 100ms.
     ❯ setup-timeout.test.ts:4:7
          2|       import { aroundEach, test } from 'vitest'
          3| 
          4|       aroundEach(async (runTest) => {
           |       ^
          5|         console.log('>> setup start')
          6|         // Simulate slow setup

    ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯

    "
  `)
})

test('aroundEach teardown phase timeout', async () => {
  const { stdout, stderr } = await runInlineTests({
    'teardown-timeout.test.ts': `
      import { aroundEach, test } from 'vitest'

      aroundEach(async (runTest) => {
        console.log('>> setup')
        await runTest()
        console.log('>> teardown start')
        // Simulate slow teardown
        await new Promise(r => setTimeout(r, 5000))
        console.log('>> teardown end (should not reach)')
      }, 100) // 100ms timeout

      test('test with slow teardown', () => {
        console.log('>> test')
      })
    `,
  })

  expect(stderr).toMatchInlineSnapshot(`
    "
    ⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

     FAIL  teardown-timeout.test.ts > test with slow teardown
    Error: The teardown phase of "aroundEach" hook timed out after 100ms.
     ❯ teardown-timeout.test.ts:4:7
          2|       import { aroundEach, test } from 'vitest'
          3| 
          4|       aroundEach(async (runTest) => {
           |       ^
          5|         console.log('>> setup')
          6|         await runTest()

    ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯

    "
  `)
  expect(stdout).toContain('>> setup')
  expect(stdout).toContain('>> test')
  expect(stdout).toContain('>> teardown start')
})

test('aroundEach setup and teardown have independent timeouts', async () => {
  const { stdout, stderr, errorTree } = await runInlineTests({
    'independent-timeouts.test.ts': `
      import { aroundEach, test } from 'vitest'

      aroundEach(async (runTest) => {
        // Setup takes 80ms - under the 100ms timeout
        console.log('>> setup start')
        await new Promise(r => setTimeout(r, 80))
        console.log('>> setup end')
        await runTest()
        // Teardown takes 80ms - under the 100ms timeout
        console.log('>> teardown start')
        await new Promise(r => setTimeout(r, 80))
        console.log('>> teardown end')
      }, 100) // 100ms timeout for each phase

      test('test with slow but valid phases', () => {
        console.log('>> test')
      })
    `,
  })

  // Both phases complete within their individual timeouts
  expect(stderr).toBe('')
  expect(stdout).toContain('>> setup start')
  expect(stdout).toContain('>> setup end')
  expect(stdout).toContain('>> test')
  expect(stdout).toContain('>> teardown start')
  expect(stdout).toContain('>> teardown end')
  expect(errorTree()).toMatchInlineSnapshot(`
    {
      "independent-timeouts.test.ts": {
        "test with slow but valid phases": "passed",
      },
    }
  `)
})

test('aroundEach default timeout uses hookTimeout config', async () => {
  const { stderr } = await runInlineTests({
    'default-timeout.test.ts': `
      import { aroundEach, test } from 'vitest'

      aroundEach(async (runTest) => {
        // Setup takes longer than hookTimeout (50ms)
        await new Promise(r => setTimeout(r, 200))
        await runTest()
      })

      test('test', () => {})
    `,
  }, { hookTimeout: 50 })

  expect(stderr).toMatchInlineSnapshot(`
    "
    ⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

     FAIL  default-timeout.test.ts > test
    Error: The setup phase of "aroundEach" hook timed out after 50ms.
     ❯ default-timeout.test.ts:4:7
          2|       import { aroundEach, test } from 'vitest'
          3| 
          4|       aroundEach(async (runTest) => {
           |       ^
          5|         // Setup takes longer than hookTimeout (50ms)
          6|         await new Promise(r => setTimeout(r, 200))

    ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯

    "
  `)
})

test('multiple aroundEach hooks with different timeouts', async () => {
  const { stdout, stderr, errorTree } = await runInlineTests({
    'multiple-timeouts.test.ts': `
      import { aroundEach, test } from 'vitest'

      // Outer hook with 200ms timeout
      aroundEach(async (runTest) => {
        console.log('>> outer setup')
        await runTest()
        console.log('>> outer teardown')
      }, 200)

      // Inner hook with 50ms timeout - this should timeout during setup
      aroundEach(async (runTest) => {
        console.log('>> inner setup start')
        await new Promise(r => setTimeout(r, 100)) // 100ms > 50ms timeout
        console.log('>> inner setup end (should not reach)')
        await runTest()
        console.log('>> inner teardown')
      }, 50)

      test('test', () => {
        console.log('>> test (should not run)')
      })
    `,
  })

  expect(stdout).toContain('>> outer setup')
  expect(stdout).toContain('>> inner setup start')
  expect(stderr).toMatchInlineSnapshot(`
    "
    ⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

     FAIL  multiple-timeouts.test.ts > test
    Error: The setup phase of "aroundEach" hook timed out after 50ms.
     ❯ multiple-timeouts.test.ts:12:7
         10| 
         11|       // Inner hook with 50ms timeout - this should timeout during set…
         12|       aroundEach(async (runTest) => {
           |       ^
         13|         console.log('>> inner setup start')
         14|         await new Promise(r => setTimeout(r, 100)) // 100ms > 50ms tim…

    ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯

    "
  `)
  expect(errorTree()).toMatchInlineSnapshot(`
    {
      "multiple-timeouts.test.ts": {
        "test": [
          "The setup phase of "aroundEach" hook timed out after 50ms.",
        ],
      },
    }
  `)
})

test('multiple aroundEach hooks where inner teardown times out', async () => {
  const { stdout, stderr, errorTree } = await runInlineTests({
    'multiple-teardown-timeout.test.ts': `
      import { aroundEach, test } from 'vitest'

      // Outer hook with 200ms timeout
      aroundEach(async (runTest) => {
        console.log('>> outer setup')
        await runTest()
        console.log('>> outer teardown')
      }, 200)

      // Inner hook with 50ms timeout - this should timeout during teardown
      aroundEach(async (runTest) => {
        console.log('>> inner setup')
        await runTest()
        console.log('>> inner teardown start')
        await new Promise(r => setTimeout(r, 100)) // 100ms > 50ms timeout
        console.log('>> inner teardown end (should not reach)')
      }, 50)

      test('test', () => {
        console.log('>> test')
      })
    `,
  })

  expect(stdout).toContain('>> outer setup')
  expect(stdout).toContain('>> inner setup')
  expect(stdout).toContain('>> test')
  expect(stdout).toContain('>> inner teardown start')
  expect(stderr).toMatchInlineSnapshot(`
    "
    ⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

     FAIL  multiple-teardown-timeout.test.ts > test
    Error: The teardown phase of "aroundEach" hook timed out after 50ms.
     ❯ multiple-teardown-timeout.test.ts:12:7
         10| 
         11|       // Inner hook with 50ms timeout - this should timeout during tea…
         12|       aroundEach(async (runTest) => {
           |       ^
         13|         console.log('>> inner setup')
         14|         await runTest()

    ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯

    "
  `)
  expect(errorTree()).toMatchInlineSnapshot(`
    {
      "multiple-teardown-timeout.test.ts": {
        "test": [
          "The teardown phase of "aroundEach" hook timed out after 50ms.",
        ],
      },
    }
  `)
})

test('aroundEach hook timeouts are independent of each other', async () => {
  const { stdout, stderr, errorTree } = await runInlineTests({
    'independent-hook-timeouts.test.ts': `
      import { aroundEach, test } from 'vitest'

      // First hook with short 50ms timeout - but completes quickly
      aroundEach(async (runTest) => {
        console.log('>> first hook setup')
        await runTest()
        console.log('>> first hook teardown')
      }, 50)

      // Second hook with 200ms timeout - takes 100ms which is longer than
      // the first hook's 50ms timeout, but within its own 200ms timeout
      aroundEach(async (runTest) => {
        console.log('>> second hook setup start')
        await new Promise(r => setTimeout(r, 100))
        console.log('>> second hook setup end')
        await runTest()
        console.log('>> second hook teardown start')
        await new Promise(r => setTimeout(r, 100))
        console.log('>> second hook teardown end')
      }, 200)

      test('test', () => {
        console.log('>> test')
      })
    `,
  })

  expect(stderr).toBe('')
  expect(stdout).toContain('>> first hook setup')
  expect(stdout).toContain('>> second hook setup start')
  expect(stdout).toContain('>> second hook setup end')
  expect(stdout).toContain('>> test')
  expect(stdout).toContain('>> second hook teardown start')
  expect(stdout).toContain('>> second hook teardown end')
  expect(stdout).toContain('>> first hook teardown')
  expect(errorTree()).toMatchInlineSnapshot(`
    {
      "independent-hook-timeouts.test.ts": {
        "test": "passed",
      },
    }
  `)
})

test('aroundEach with AsyncLocalStorage', async () => {
  const { stdout, stderr, errorTree } = await runInlineTests({
    'async-local-storage.test.ts': `
      import { AsyncLocalStorage } from 'node:async_hooks'
      import { aroundEach, test, expect } from 'vitest'

      const requestContext = new AsyncLocalStorage<{ requestId: number }>()
      let requestIdx = 0

      aroundEach(async (runTest) => {
        const ctx = { requestId: ++requestIdx }
        console.log('>> setting context:', ctx.requestId)
        await requestContext.run(ctx, runTest)
        console.log('>> context cleared')
      })

      test('first test gets requestId 1', () => {
        const ctx = requestContext.getStore()
        console.log('>> test got context:', ctx?.requestId)
        expect(ctx).toBeDefined()
        expect(ctx?.requestId).toBe(1)
      })

      test('second test gets fresh context with requestId 2', () => {
        const ctx = requestContext.getStore()
        console.log('>> test got context:', ctx?.requestId)
        expect(ctx?.requestId).toBe(2)
      })
    `,
  })

  expect(stderr).toBe('')
  expect(stdout).toContain('>> setting context: 1')
  expect(stdout).toContain('>> setting context: 2')
  expect(stdout).toContain('>> context cleared')
  expect(errorTree()).toMatchInlineSnapshot(`
    {
      "async-local-storage.test.ts": {
        "first test gets requestId 1": "passed",
        "second test gets fresh context with requestId 2": "passed",
      },
    }
  `)
})

test('aroundEach with fixtures', async () => {
  const { stdout, stderr, errorTree } = await runInlineTests({
    'fixtures.test.ts': `
      import { test as base, aroundEach, expect } from 'vitest'

      const test = base.extend<{ db: { query: (sql: string) => string } }>({
        db: async ({}, use) => {
          console.log('>> db fixture setup')
          await use({
            query: (sql: string) => \`result of: \${sql}\`
          })
          console.log('>> db fixture teardown')
        }
      })

      test.aroundEach(async (runTest, { db }) => {
        console.log('>> aroundEach setup, db available:', !!db)
        const result = db.query('SELECT 1')
        console.log('>> query result:', result)
        await runTest()
        console.log('>> aroundEach teardown')
      })

      test('test with fixture in aroundEach', ({ db }) => {
        console.log('>> test running, db available:', !!db)
        expect(db.query('SELECT 2')).toBe('result of: SELECT 2')
      })
    `,
  })

  expect(stderr).toBe('')
  expect(stdout).toContain('>> db fixture setup')
  expect(stdout).toContain('>> aroundEach setup, db available: true')
  expect(stdout).toContain('>> query result: result of: SELECT 1')
  expect(stdout).toContain('>> test running, db available: true')
  expect(stdout).toContain('>> aroundEach teardown')
  expect(stdout).toContain('>> db fixture teardown')
  expect(errorTree()).toMatchInlineSnapshot(`
    {
      "fixtures.test.ts": {
        "test with fixture in aroundEach": "passed",
      },
    }
  `)
})

test('aroundEach with AsyncLocalStorage fixture and value fixture', async () => {
  const { stdout, stderr, errorTree } = await runInlineTests({
    'als-fixtures.test.ts': `
      import { test as base, aroundEach, expect } from 'vitest'
      import { AsyncLocalStorage } from 'node:async_hooks'

      interface RequestContext {
        requestId: number
      }

      let requestIdx = 0

      const test = base.extend<{
        requestContext: AsyncLocalStorage<RequestContext>
        currentRequestId: number
      }>({
        requestContext: async ({}, use) => {
          const als = new AsyncLocalStorage<RequestContext>()
          await use(als)
        },
        currentRequestId: async ({ requestContext }, use) => {
          const store = requestContext.getStore()
          await use(store?.requestId)
        }
      })

      aroundEach(async (runTest, { requestContext }) => {
        const id = ++requestIdx
        console.log('>> setting context:', id)
        await requestContext.run({ requestId: id }, async () => {
          await runTest()
        })
        console.log('>> context cleared')
      })

      test('first test gets requestId 1 via fixture', ({ currentRequestId }) => {
        console.log('>> test got requestId:', currentRequestId)
        expect(currentRequestId).toBe(1)
      })

      test('second test gets requestId 2 via fixture', ({ currentRequestId }) => {
        console.log('>> test got requestId:', currentRequestId)
        expect(currentRequestId).toBe(2)
      })
    `,
  })

  expect(stderr).toBe('')
  expect(stdout).toContain('>> setting context: 1')
  expect(stdout).toContain('>> setting context: 2')
  expect(stdout).toContain('>> test got requestId: 1')
  expect(stdout).toContain('>> test got requestId: 2')
  expect(stdout).toContain('>> context cleared')
  expect(errorTree()).toMatchInlineSnapshot(`
    {
      "als-fixtures.test.ts": {
        "first test gets requestId 1 via fixture": "passed",
        "second test gets requestId 2 via fixture": "passed",
      },
    }
  `)
})
