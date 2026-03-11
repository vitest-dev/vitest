import { expect, test } from 'vitest'
import { runInlineTests } from '../../test-utils'

function extractLogs(stdout: string): string {
  return stdout.split('\n').filter(l => l.includes('>>')).join('\n')
}

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
  expect(extractLogs(stdout)).toMatchInlineSnapshot(`
    ">> before test
    >> inside test
    >> after test"
  `)
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
  expect(extractLogs(stdout)).toMatchInlineSnapshot(`
    ">> root before
    >> suite1 before
    >> test suite1
    >> suite1 after
    >> root after
    >> root before
    >> suite1 before
    >> nested before
    >> test nested
    >> nested after
    >> suite1 after
    >> root after"
  `)
})

test('throws error when runTest is called multiple times', async () => {
  const { stderr } = await runInlineTests({
    'multiple-calls.test.ts': `
      import { aroundEach, test } from 'vitest'

      aroundEach(async (runTest) => {
        await runTest()
        await runTest() // second call should throw
      })

      test('test 1', () => {
        console.log('>> test ran')
      })
    `,
  })

  expect(stderr).toMatchInlineSnapshot(`
    "
    ⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

     FAIL  multiple-calls.test.ts > test 1
    AroundHookMultipleCallsError: The \`runTest()\` callback was called multiple times in the \`aroundEach\` hook. The callback can only be called once per hook.
     ❯ multiple-calls.test.ts:6:15
          4|       aroundEach(async (runTest) => {
          5|         await runTest()
          6|         await runTest() // second call should throw
           |               ^
          7|       })
          8|

    ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯

    "
  `)
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

  expect(stderr).toMatchInlineSnapshot(`
    "
    ⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

     FAIL  no-runtest.test.ts > test 1
    AroundHookSetupError: The \`runTest()\` callback was not called in the \`aroundEach\` hook. Make sure to call \`runTest()\` to run the test.
    ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯

    "
  `)
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
  expect(extractLogs(stdout)).toMatchInlineSnapshot(`
    ">> aroundEach run 1
    >> test 1
    >> aroundEach run 2
    >> test 2
    >> aroundEach run 3
    >> test 3"
  `)
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
  expect(extractLogs(stdout)).toMatchInlineSnapshot(`
    ">> test name: my test name
    >> inside test"
  `)
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
  expect(extractLogs(stdout)).toMatchInlineSnapshot(`
    ">> setup
    >> test running
    >> cleanup (should run)"
  `)
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
  expect(extractLogs(stdout)).toMatchInlineSnapshot(`">> before error"`)
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

  expect(extractLogs(stdout)).toMatchInlineSnapshot(`
    ">> setup
    >> test ran
    >> cleanup before error"
  `)
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
  expect(extractLogs(stdout)).toMatchInlineSnapshot(`
    ">> aroundEach global
    >> test
    >> aroundEach global done"
  `)
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
  expect(extractLogs(stdout)).toMatchInlineSnapshot(`
    ">> aroundEach for: test 1
    >> test value: 1
    >> aroundEach for: test 2
    >> test value: 2
    >> aroundEach for: test 3
    >> test value: 3"
  `)
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
  expect(extractLogs(stdout)).toMatchInlineSnapshot(`
    ">> aroundEach attempt: 1
    >> test attempt: 1
    >> aroundEach attempt: 2
    >> test attempt: 2
    >> aroundEach attempt: 3
    >> test attempt: 3"
  `)
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
  expect(extractLogs(stdout)).toMatchInlineSnapshot(`
    ">> suite name: my suite
    >> test"
  `)
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
  expect(extractLogs(stdout)).toMatchInlineSnapshot(`
    ">> aroundEach for: normal test
    >> normal test"
  `)
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
    AroundHookSetupError: The setup phase of "aroundEach" hook timed out after 100ms.
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
    AroundHookTeardownError: The teardown phase of "aroundEach" hook timed out after 100ms.
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
  expect(extractLogs(stdout)).toMatchInlineSnapshot(`
    ">> setup
    >> test
    >> teardown start"
  `)
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
  expect(extractLogs(stdout)).toMatchInlineSnapshot(`
    ">> setup start
    >> setup end
    >> test
    >> teardown start
    >> teardown end"
  `)
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
        // Setup takes longer than hookTimeout (10ms)
        await new Promise(r => setTimeout(r, 200))
        await runTest()
      })

      test('test', () => {})
    `,
  }, { hookTimeout: 10 })

  expect(stderr).toMatchInlineSnapshot(`
    "
    ⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

     FAIL  default-timeout.test.ts > test
    AroundHookSetupError: The setup phase of "aroundEach" hook timed out after 10ms.
     ❯ default-timeout.test.ts:4:7
          2|       import { aroundEach, test } from 'vitest'
          3|
          4|       aroundEach(async (runTest) => {
           |       ^
          5|         // Setup takes longer than hookTimeout (10ms)
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
      }, 10)

      test('test', () => {
        console.log('>> test (should not run)')
      })
    `,
  })

  expect(extractLogs(stdout)).toMatchInlineSnapshot(`
    ">> outer setup
    >> inner setup start
    >> outer teardown"
  `)
  expect(stderr).toMatchInlineSnapshot(`
    "
    ⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

     FAIL  multiple-timeouts.test.ts > test
    AroundHookSetupError: The setup phase of "aroundEach" hook timed out after 10ms.
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
          "The setup phase of "aroundEach" hook timed out after 10ms.",
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
      }, 10)

      test('test', () => {
        console.log('>> test')
      })
    `,
  })

  expect(extractLogs(stdout)).toMatchInlineSnapshot(`
    ">> outer setup
    >> inner setup
    >> test
    >> inner teardown start
    >> outer teardown"
  `)
  expect(stderr).toMatchInlineSnapshot(`
    "
    ⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

     FAIL  multiple-teardown-timeout.test.ts > test
    AroundHookTeardownError: The teardown phase of "aroundEach" hook timed out after 10ms.
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
          "The teardown phase of "aroundEach" hook timed out after 10ms.",
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
      }, 10)

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
  expect(extractLogs(stdout)).toMatchInlineSnapshot(`
    ">> first hook setup
    >> second hook setup start
    >> second hook setup end
    >> test
    >> second hook teardown start
    >> second hook teardown end
    >> first hook teardown"
  `)
  expect(errorTree()).toMatchInlineSnapshot(`
    {
      "independent-hook-timeouts.test.ts": {
        "test": "passed",
      },
    }
  `)
})

test('aroundEach teardown timeout works when runTest error is caught', async () => {
  const { errorTree } = await runInlineTests({
    'caught-inner-error-timeout.test.ts': `
      import { aroundEach, describe, expect, test } from 'vitest'

      describe('suite', () => {
        aroundEach(async (runTest) => {
          try {
            await runTest()
          }
          catch {
            // swallow inner hook failure, then run teardown work
          }
          await new Promise(resolve => setTimeout(resolve, 200))
        }, 50)

        aroundEach(async (runTest) => {
          await runTest()
          throw new Error('inner aroundEach teardown failure')
        })

        test('test', () => {
          expect(1).toBe(1)
        })
      })
    `,
  })

  expect(errorTree()).toMatchInlineSnapshot(`
    {
      "caught-inner-error-timeout.test.ts": {
        "suite": {
          "test": [
            "inner aroundEach teardown failure",
            "The teardown phase of "aroundEach" hook timed out after 50ms.",
          ],
        },
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
  expect(extractLogs(stdout)).toMatchInlineSnapshot(`
    ">> setting context: 1
    >> test got context: 1
    >> context cleared
    >> setting context: 2
    >> test got context: 2
    >> context cleared"
  `)
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
        },
        user: async ({}, use) => {
          console.log('>> user fixture setup')
          await use({ name: 'test-user' })
          console.log('>> user fixture teardown')
        },
      })

      test.aroundEach(async (runTest, { db }) => {
        console.log('>> aroundEach setup, db available:', !!db)
        const result = db.query('SELECT 1')
        console.log('>> query result:', result)
        await runTest()
        console.log('>> aroundEach teardown')
      })

      test('test with fixture in aroundEach', ({ db, user }) => {
        console.log('>> test running, db available:', !!db)
        expect(db.query('SELECT 2')).toBe('result of: SELECT 2')
        expect(user.name).toBe('test-user')
      })
    `,
  })

  expect(stderr).toBe('')
  expect(extractLogs(stdout)).toMatchInlineSnapshot(`
    ">> db fixture setup
    >> aroundEach setup, db available: true
    >> query result: result of: SELECT 1
    >> user fixture setup
    >> test running, db available: true
    >> user fixture teardown
    >> aroundEach teardown
    >> db fixture teardown"
  `)
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
  expect(extractLogs(stdout)).toMatchInlineSnapshot(`
    ">> setting context: 1
    >> test got requestId: 1
    >> context cleared
    >> setting context: 2
    >> test got requestId: 2
    >> context cleared"
  `)
  expect(errorTree()).toMatchInlineSnapshot(`
    {
      "als-fixtures.test.ts": {
        "first test gets requestId 1 via fixture": "passed",
        "second test gets requestId 2 via fixture": "passed",
      },
    }
  `)
})

// aroundAll tests

test('basic aroundAll wraps the suite', async () => {
  const { stdout, stderr, errorTree } = await runInlineTests({
    'basic.test.ts': `
      import { test, aroundAll } from 'vitest'

      aroundAll(async (runSuite) => {
        console.log('>> aroundAll setup')
        await runSuite()
        console.log('>> aroundAll teardown')
      })

      test('first test', () => {
        console.log('>> first test running')
      })

      test('second test', () => {
        console.log('>> second test running')
      })
    `,
  })

  expect(stderr).toBe('')
  expect(extractLogs(stdout)).toMatchInlineSnapshot(`
    ">> aroundAll setup
    >> first test running
    >> second test running
    >> aroundAll teardown"
  `)
  expect(errorTree()).toMatchInlineSnapshot(`
    {
      "basic.test.ts": {
        "first test": "passed",
        "second test": "passed",
      },
    }
  `)
})

test('multiple aroundAll hooks are nested (first is outermost)', async () => {
  const { stdout, stderr, errorTree } = await runInlineTests({
    'nested.test.ts': `
      import { test, aroundAll } from 'vitest'

      aroundAll(async (runSuite) => {
        console.log('>> outer setup')
        await runSuite()
        console.log('>> outer teardown')
      })

      aroundAll(async (runSuite) => {
        console.log('>> inner setup')
        await runSuite()
        console.log('>> inner teardown')
      })

      test('test', () => {
        console.log('>> test running')
      })
    `,
  })

  expect(stderr).toBe('')
  expect(extractLogs(stdout)).toMatchInlineSnapshot(`
    ">> outer setup
    >> inner setup
    >> test running
    >> inner teardown
    >> outer teardown"
  `)
  expect(errorTree()).toMatchInlineSnapshot(`
    {
      "nested.test.ts": {
        "test": "passed",
      },
    }
  `)
})

test('aroundAll in nested suites wraps correctly', async () => {
  const { stdout, stderr, errorTree } = await runInlineTests({
    'nested-suite.test.ts': `
      import { test, describe, aroundAll } from 'vitest'

      aroundAll(async (runSuite) => {
        console.log('>> root aroundAll setup')
        await runSuite()
        console.log('>> root aroundAll teardown')
      })

      test('root test', () => {
        console.log('>> root test running')
      })

      describe('nested suite', () => {
        aroundAll(async (runSuite) => {
          console.log('>> nested aroundAll setup')
          await runSuite()
          console.log('>> nested aroundAll teardown')
        })

        test('nested test', () => {
          console.log('>> nested test running')
        })
      })
    `,
  })

  expect(stderr).toBe('')
  expect(extractLogs(stdout)).toMatchInlineSnapshot(`
    ">> root aroundAll setup
    >> root test running
    >> nested aroundAll setup
    >> nested test running
    >> nested aroundAll teardown
    >> root aroundAll teardown"
  `)
  expect(errorTree()).toMatchInlineSnapshot(`
    {
      "nested-suite.test.ts": {
        "nested suite": {
          "nested test": "passed",
        },
        "root test": "passed",
      },
    }
  `)
})

test('aroundAll throws error when runSuite is called multiple times', async () => {
  const { stderr } = await runInlineTests({
    'multiple-calls.test.ts': `
      import { test, aroundAll } from 'vitest'

      aroundAll(async (runSuite) => {
        await runSuite()
        await runSuite() // second call should throw
      })

      test('test', () => {
        console.log('>> test running')
      })
    `,
  })

  expect(stderr).toMatchInlineSnapshot(`
    "
    ⎯⎯⎯⎯⎯⎯ Failed Suites 1 ⎯⎯⎯⎯⎯⎯⎯

     FAIL  multiple-calls.test.ts [ multiple-calls.test.ts ]
    AroundHookMultipleCallsError: The \`runSuite()\` callback was called multiple times in the \`aroundAll\` hook. The callback can only be called once per hook.
     ❯ multiple-calls.test.ts:6:15
          4|       aroundAll(async (runSuite) => {
          5|         await runSuite()
          6|         await runSuite() // second call should throw
           |               ^
          7|       })
          8|

    ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯

    "
  `)
})

test('aroundAll throws error when runSuite is not called', async () => {
  const { stderr, errorTree } = await runInlineTests({
    'no-run.test.ts': `
      import { test, aroundAll } from 'vitest'

      aroundAll(async (runSuite) => {
        console.log('>> aroundAll setup but not calling runSuite')
      })

      test('test', () => {
        console.log('>> test running')
      })
    `,
  })

  expect(stderr).toContain('runSuite()')
  expect(errorTree()).toMatchInlineSnapshot(`
    {
      "no-run.test.ts": {
        "__module_errors__": [
          "The \`runSuite()\` callback was not called in the \`aroundAll\` hook. Make sure to call \`runSuite()\` to run the suite.",
        ],
        "test": "skipped",
      },
    }
  `)
})

test('aroundAll cleanup runs even on test failure', async () => {
  const { stdout, errorTree } = await runInlineTests({
    'cleanup.test.ts': `
      import { test, aroundAll, expect } from 'vitest'

      aroundAll(async (runSuite) => {
        console.log('>> aroundAll setup')
        await runSuite()
        console.log('>> aroundAll teardown')
      })

      test('failing test', () => {
        console.log('>> failing test running')
        expect(true).toBe(false)
      })
    `,
  })

  expect(extractLogs(stdout)).toMatchInlineSnapshot(`
    ">> aroundAll setup
    >> failing test running
    >> aroundAll teardown"
  `)
  expect(errorTree()).toMatchInlineSnapshot(`
    {
      "cleanup.test.ts": {
        "failing test": [
          "expected true to be false // Object.is equality",
        ],
      },
    }
  `)
})

test('aroundAll with beforeAll and afterAll', async () => {
  const { stdout, stderr, errorTree } = await runInlineTests({
    'with-hooks.test.ts': `
      import { test, beforeAll, afterAll, aroundAll } from 'vitest'

      beforeAll(() => {
        console.log('>> beforeAll')
      })

      aroundAll(async (runSuite) => {
        console.log('>> aroundAll setup')
        await runSuite()
        console.log('>> aroundAll teardown')
      })

      afterAll(() => {
        console.log('>> afterAll')
      })

      test('test', () => {
        console.log('>> test running')
      })
    `,
  })

  expect(stderr).toBe('')
  expect(extractLogs(stdout)).toMatchInlineSnapshot(`
    ">> aroundAll setup
    >> beforeAll
    >> test running
    >> afterAll
    >> aroundAll teardown"
  `)
  expect(errorTree()).toMatchInlineSnapshot(`
    {
      "with-hooks.test.ts": {
        "test": "passed",
      },
    }
  `)
})

test('aroundAll setup phase timeout', async () => {
  const { stderr, errorTree } = await runInlineTests({
    'timeout.test.ts': `
      import { test, aroundAll } from 'vitest'

      aroundAll(async (runSuite) => {
        console.log('>> aroundAll setup starting')
        await new Promise(resolve => setTimeout(resolve, 200))
        console.log('>> aroundAll setup done')
        await runSuite()
      }, 10)

      test('test', () => {
        console.log('>> test running')
      })
    `,
  })

  expect(stderr).toMatchInlineSnapshot(`
    "
    ⎯⎯⎯⎯⎯⎯ Failed Suites 1 ⎯⎯⎯⎯⎯⎯⎯

     FAIL  timeout.test.ts [ timeout.test.ts ]
    AroundHookSetupError: The setup phase of "aroundAll" hook timed out after 10ms.
     ❯ timeout.test.ts:4:7
          2|       import { test, aroundAll } from 'vitest'
          3|
          4|       aroundAll(async (runSuite) => {
           |       ^
          5|         console.log('>> aroundAll setup starting')
          6|         await new Promise(resolve => setTimeout(resolve, 200))

    ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯

    "
  `)
  expect(errorTree()).toMatchInlineSnapshot(`
    {
      "timeout.test.ts": {
        "__module_errors__": [
          "The setup phase of "aroundAll" hook timed out after 10ms.",
        ],
        "test": "skipped",
      },
    }
  `)
})

test('aroundAll teardown phase timeout', async () => {
  const { stdout, stderr, errorTree } = await runInlineTests({
    'teardown-timeout.test.ts': `
      import { test, aroundAll } from 'vitest'

      aroundAll(async (runSuite) => {
        console.log('>> aroundAll setup')
        await runSuite()
        console.log('>> aroundAll teardown starting')
        await new Promise(resolve => setTimeout(resolve, 200))
        console.log('>> aroundAll teardown done')
      }, 10)

      test('test', () => {
        console.log('>> test running')
      })
    `,
  })

  expect(extractLogs(stdout)).toMatchInlineSnapshot(`
    ">> aroundAll setup
    >> test running
    >> aroundAll teardown starting"
  `)
  expect(stderr).toMatchInlineSnapshot(`
    "
    ⎯⎯⎯⎯⎯⎯ Failed Suites 1 ⎯⎯⎯⎯⎯⎯⎯

     FAIL  teardown-timeout.test.ts [ teardown-timeout.test.ts ]
    AroundHookTeardownError: The teardown phase of "aroundAll" hook timed out after 10ms.
     ❯ teardown-timeout.test.ts:4:7
          2|       import { test, aroundAll } from 'vitest'
          3|
          4|       aroundAll(async (runSuite) => {
           |       ^
          5|         console.log('>> aroundAll setup')
          6|         await runSuite()

    ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯

    "
  `)
  expect(errorTree()).toMatchInlineSnapshot(`
    {
      "teardown-timeout.test.ts": {
        "__module_errors__": [
          "The teardown phase of "aroundAll" hook timed out after 10ms.",
        ],
        "test": "passed",
      },
    }
  `)
})

test('aroundAll receives suite as third argument', async () => {
  const { stdout, stderr, errorTree } = await runInlineTests({
    'suite-arg.test.ts': `
      import { test, describe, aroundAll } from 'vitest'

      describe('my suite', () => {
        aroundAll(async (runSuite, {}, suite) => {
          console.log('>> suite name:', suite.name)
          await runSuite()
        })

        test('test', () => {
          console.log('>> test running')
        })
      })
    `,
  })

  expect(stderr).toBe('')
  expect(extractLogs(stdout)).toMatchInlineSnapshot(`
    ">> suite name: my suite
    >> test running"
  `)
  expect(errorTree()).toMatchInlineSnapshot(`
    {
      "suite-arg.test.ts": {
        "my suite": {
          "test": "passed",
        },
      },
    }
  `)
})

test('aroundAll teardown timeout works when runSuite error is caught', async () => {
  const { errorTree } = await runInlineTests({
    'caught-inner-suite-error-timeout.test.ts': `
      import { aroundAll, describe, expect, test } from 'vitest'

      describe('suite', () => {
        aroundAll(async (runSuite) => {
          try {
            await runSuite()
          }
          catch {
            // swallow inner hook failure, then run teardown work
          }
          await new Promise(resolve => setTimeout(resolve, 200))
        }, 50)

        aroundAll(async (runSuite) => {
          await runSuite()
          throw new Error('inner aroundAll teardown failure')
        })

        test('test', () => {
          expect(1).toBe(1)
        })
      })
    `,
  })

  expect(errorTree()).toMatchInlineSnapshot(`
    {
      "caught-inner-suite-error-timeout.test.ts": {
        "suite": {
          "__suite_errors__": [
            "inner aroundAll teardown failure",
            "The teardown phase of "aroundAll" hook timed out after 50ms.",
          ],
          "test": "passed",
        },
      },
    }
  `)
})

test('aroundAll with server start/stop pattern', async () => {
  const { stdout, stderr, errorTree } = await runInlineTests({
    'server.test.ts': `
      import { test, aroundAll, expect } from 'vitest'

      let serverPort: number | null = null

      aroundAll(async (runSuite) => {
        // Simulate server start
        serverPort = 3000
        console.log('>> server started on port', serverPort)
        await runSuite()
        // Simulate server stop
        console.log('>> server stopping')
        serverPort = null
      })

      test('first request', () => {
        console.log('>> making request to port', serverPort)
        expect(serverPort).toBe(3000)
      })

      test('second request', () => {
        console.log('>> making request to port', serverPort)
        expect(serverPort).toBe(3000)
      })
    `,
  })

  expect(stderr).toBe('')
  expect(extractLogs(stdout)).toMatchInlineSnapshot(`
    ">> server started on port 3000
    >> making request to port 3000
    >> making request to port 3000
    >> server stopping"
  `)
  expect(errorTree()).toMatchInlineSnapshot(`
    {
      "server.test.ts": {
        "first request": "passed",
        "second request": "passed",
      },
    }
  `)
})

test('aroundAll with multiple suites and multiple hooks in same suite', async () => {
  const { stdout, stderr, errorTree } = await runInlineTests({
    'multi-suite.test.ts': `
      import { test, describe, aroundAll } from 'vitest'

      aroundAll(async (runSuite) => {
        console.log('>> root aroundAll 1 setup')
        await runSuite()
        console.log('>> root aroundAll 1 teardown')
      })

      aroundAll(async (runSuite) => {
        console.log('>> root aroundAll 2 setup')
        await runSuite()
        console.log('>> root aroundAll 2 teardown')
      })

      test('root test', () => {
        console.log('>> root test')
      })

      describe('suite A', () => {
        aroundAll(async (runSuite) => {
          console.log('>> suite A aroundAll 1 setup')
          await runSuite()
          console.log('>> suite A aroundAll 1 teardown')
        })

        aroundAll(async (runSuite) => {
          console.log('>> suite A aroundAll 2 setup')
          await runSuite()
          console.log('>> suite A aroundAll 2 teardown')
        })

        test('test A1', () => {
          console.log('>> test A1')
        })

        test('test A2', () => {
          console.log('>> test A2')
        })
      })

      describe('suite B', () => {
        aroundAll(async (runSuite) => {
          console.log('>> suite B aroundAll setup')
          await runSuite()
          console.log('>> suite B aroundAll teardown')
        })

        test('test B1', () => {
          console.log('>> test B1')
        })

        describe('nested suite', () => {
          aroundAll(async (runSuite) => {
            console.log('>> nested aroundAll setup')
            await runSuite()
            console.log('>> nested aroundAll teardown')
          })

          test('nested test', () => {
            console.log('>> nested test')
          })
        })
      })
    `,
  })

  expect(stderr).toBe('')
  expect(extractLogs(stdout)).toMatchInlineSnapshot(`
    ">> root aroundAll 1 setup
    >> root aroundAll 2 setup
    >> root test
    >> suite A aroundAll 1 setup
    >> suite A aroundAll 2 setup
    >> test A1
    >> test A2
    >> suite A aroundAll 2 teardown
    >> suite A aroundAll 1 teardown
    >> suite B aroundAll setup
    >> test B1
    >> nested aroundAll setup
    >> nested test
    >> nested aroundAll teardown
    >> suite B aroundAll teardown
    >> root aroundAll 2 teardown
    >> root aroundAll 1 teardown"
  `)
  expect(errorTree()).toMatchInlineSnapshot(`
    {
      "multi-suite.test.ts": {
        "root test": "passed",
        "suite A": {
          "test A1": "passed",
          "test A2": "passed",
        },
        "suite B": {
          "nested suite": {
            "nested test": "passed",
          },
          "test B1": "passed",
        },
      },
    }
  `)
})

test('aroundAll with module-level AsyncLocalStorage and test fixture', async () => {
  const { stdout, stderr, errorTree } = await runInlineTests({
    'module-als.test.ts': `
      import { test as base, aroundAll, expect } from 'vitest'
      import { AsyncLocalStorage } from 'node:async_hooks'

      interface RequestContext {
        requestId: number
      }

      // Module-level AsyncLocalStorage shared between aroundAll and fixtures
      const requestContext = new AsyncLocalStorage<RequestContext>()
      let suiteRequestId = 0

      const test = base.extend<{
        currentRequestId: number
      }>({
        currentRequestId: async ({}, use) => {
          const store = requestContext.getStore()
          console.log('>> currentRequestId fixture reading store:', store?.requestId)
          await use(store?.requestId)
        }
      })

      aroundAll(async (runSuite) => {
        suiteRequestId++
        console.log('>> aroundAll setup, setting requestId:', suiteRequestId)
        await requestContext.run({ requestId: suiteRequestId }, async () => {
          await runSuite()
        })
        console.log('>> aroundAll teardown')
      })

      test('first test gets requestId from aroundAll context', ({ currentRequestId }) => {
        console.log('>> first test, currentRequestId:', currentRequestId)
        expect(currentRequestId).toBe(1)
      })

      test('second test gets same requestId from aroundAll context', ({ currentRequestId }) => {
        console.log('>> second test, currentRequestId:', currentRequestId)
        expect(currentRequestId).toBe(1)
      })
    `,
  })

  expect(stderr).toBe('')
  expect(extractLogs(stdout)).toMatchInlineSnapshot(`
    ">> aroundAll setup, setting requestId: 1
    >> currentRequestId fixture reading store: 1
    >> first test, currentRequestId: 1
    >> currentRequestId fixture reading store: 1
    >> second test, currentRequestId: 1
    >> aroundAll teardown"
  `)
  expect(errorTree()).toMatchInlineSnapshot(`
    {
      "module-als.test.ts": {
        "first test gets requestId from aroundAll context": "passed",
        "second test gets same requestId from aroundAll context": "passed",
      },
    }
  `)
})

test('tests are skipped when aroundAll setup fails', async () => {
  const { stderr, errorTree } = await runInlineTests({
    'aroundAll-setup-error.test.ts': `
      import { test, aroundAll } from 'vitest'

      aroundAll(async () => {
        throw new Error('aroundAll setup error')
      })

      test('test should be skipped', () => {
        console.log('>> test should not run')
      })
    `,
  })

  expect(stderr).toMatchInlineSnapshot(`
    "
    ⎯⎯⎯⎯⎯⎯ Failed Suites 1 ⎯⎯⎯⎯⎯⎯⎯

     FAIL  aroundAll-setup-error.test.ts [ aroundAll-setup-error.test.ts ]
    Error: aroundAll setup error
     ❯ aroundAll-setup-error.test.ts:5:15
          3|
          4|       aroundAll(async () => {
          5|         throw new Error('aroundAll setup error')
           |               ^
          6|       })
          7|

    ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯

    "
  `)

  // Test should be skipped because aroundAll setup failed
  expect(errorTree()).toMatchInlineSnapshot(`
    {
      "aroundAll-setup-error.test.ts": {
        "__module_errors__": [
          "aroundAll setup error",
        ],
        "test should be skipped": "skipped",
      },
    }
  `)
})

test('aroundEach teardown timeout works when inner fails', async () => {
  const { stderr, errorTree } = await runInlineTests({
    'caught-inner-error-timeout.test.ts': `
      import { aroundEach, afterAll, describe, expect, test } from 'vitest'

      let errorCaught = false

      afterAll(() => {
        expect(errorCaught).toBe(false)
      })

      describe('suite', () => {
        aroundEach(async (runTest) => {
          try {
            await runTest()
          }
          catch {
            errorCaught = true
          }
          // this should timeout
          await new Promise(resolve => setTimeout(resolve, 200))
        }, 50)

        aroundEach(async (runTest) => {
          await runTest()
          throw new Error('inner aroundEach teardown failure')
        })

        test('test', () => {
          expect(1).toBe(1)
        })
      })
    `,
  })

  expect(stderr).toMatchInlineSnapshot(`
    "
    ⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

     FAIL  caught-inner-error-timeout.test.ts > suite > test
    Error: inner aroundEach teardown failure
     ❯ caught-inner-error-timeout.test.ts:24:17
         22|         aroundEach(async (runTest) => {
         23|           await runTest()
         24|           throw new Error('inner aroundEach teardown failure')
           |                 ^
         25|         })
         26|

    ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/2]⎯

     FAIL  caught-inner-error-timeout.test.ts > suite > test
    AroundHookTeardownError: The teardown phase of "aroundEach" hook timed out after 50ms.
     ❯ caught-inner-error-timeout.test.ts:11:9
          9|
         10|       describe('suite', () => {
         11|         aroundEach(async (runTest) => {
           |         ^
         12|           try {
         13|             await runTest()

    ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/2]⎯

    "
  `)
  expect(errorTree()).toMatchInlineSnapshot(`
    {
      "caught-inner-error-timeout.test.ts": {
        "suite": {
          "test": [
            "inner aroundEach teardown failure",
            "The teardown phase of "aroundEach" hook timed out after 50ms.",
          ],
        },
      },
    }
  `)
})

test('aroundAll teardown timeout works when inner fails', async () => {
  const { stderr, errorTree } = await runInlineTests({
    'caught-inner-error-timeout.test.ts': `
      import { aroundAll, afterAll, describe, expect, test } from 'vitest'

      let errorCaught = false

      afterAll(() => {
        expect(errorCaught).toBe(false)
      })

      describe('suite', () => {
        aroundAll(async (runTest) => {
          try {
            await runTest()
          }
          catch {
            errorCaught = true
          }
          // this should timeout
          await new Promise(resolve => setTimeout(resolve, 200))
        }, 50)

        aroundAll(async (runTest) => {
          await runTest()
          throw new Error('inner aroundAll teardown failure')
        })

        test('test', () => {
          expect(1).toBe(1)
        })
      })
    `,
  })

  expect(stderr).toMatchInlineSnapshot(`
    "
    ⎯⎯⎯⎯⎯⎯ Failed Suites 1 ⎯⎯⎯⎯⎯⎯⎯

     FAIL  caught-inner-error-timeout.test.ts > suite
    Error: inner aroundAll teardown failure
     ❯ caught-inner-error-timeout.test.ts:24:17
         22|         aroundAll(async (runTest) => {
         23|           await runTest()
         24|           throw new Error('inner aroundAll teardown failure')
           |                 ^
         25|         })
         26|

    ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/2]⎯

     FAIL  caught-inner-error-timeout.test.ts > suite
    AroundHookTeardownError: The teardown phase of "aroundAll" hook timed out after 50ms.
     ❯ caught-inner-error-timeout.test.ts:11:9
          9|
         10|       describe('suite', () => {
         11|         aroundAll(async (runTest) => {
           |         ^
         12|           try {
         13|             await runTest()

    ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/2]⎯

    "
  `)
  expect(errorTree()).toMatchInlineSnapshot(`
    {
      "caught-inner-error-timeout.test.ts": {
        "suite": {
          "__suite_errors__": [
            "inner aroundAll teardown failure",
            "The teardown phase of "aroundAll" hook timed out after 50ms.",
          ],
          "test": "passed",
        },
      },
    }
  `)
})

test('aroundEach aborts late runTest after setup timeout', async () => {
  const { stdout, stderr, errorTree } = await runInlineTests({
    'late-run-test-after-timeout.test.ts': `
      import { afterAll, aroundEach, test } from 'vitest'

      afterAll(async () => {
        console.log('>> afterAll 0ms')
        await new Promise(r => setTimeout(r, 200))
        console.log('>> afterAll 200ms')
      })

      aroundEach(async (runTest) => {
        console.log(">> outer aroundEach setup 0ms")
        await new Promise(r => setTimeout(r, 100))
        // this is still executed after timeout error
        console.log(">> outer aroundEach setup 100ms")
        // but this shouldn't continue to inner aroundEach or test
        await runTest()
        console.log(">> outer aroundEach teardown")
      }, 10)

      aroundEach(async (runTest) => {
        console.log('>> inner aroundEach setup')
        await runTest()
        console.log('>> inner aroundEach teardown')
      })

      test('basic', () => {
        console.log('>> test')
      })
    `,
  })

  expect(stderr).toMatchInlineSnapshot(`
    "
    ⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

     FAIL  late-run-test-after-timeout.test.ts > basic
    AroundHookSetupError: The setup phase of "aroundEach" hook timed out after 10ms.
     ❯ late-run-test-after-timeout.test.ts:10:7
          8|       })
          9|
         10|       aroundEach(async (runTest) => {
           |       ^
         11|         console.log(">> outer aroundEach setup 0ms")
         12|         await new Promise(r => setTimeout(r, 100))

    ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯

    "
  `)
  expect(extractLogs(stdout)).toMatchInlineSnapshot(`
    ">> outer aroundEach setup 0ms
    >> afterAll 0ms
    >> outer aroundEach setup 100ms
    >> afterAll 200ms"
  `)
  expect(errorTree()).toMatchInlineSnapshot(`
    {
      "late-run-test-after-timeout.test.ts": {
        "basic": [
          "The setup phase of "aroundEach" hook timed out after 10ms.",
        ],
      },
    }
  `)
})

test('aroundAll aborts late runSuite after setup timeout', async () => {
  const { stdout, stderr, errorTree } = await runInlineTests({
    'late-run-suite-after-timeout.test.ts': `
      import { afterAll, aroundAll, describe, test } from 'vitest'

      afterAll(async () => {
        console.log('>> afterAll 0ms')
        await new Promise(r => setTimeout(r, 200))
        console.log('>> afterAll 200ms')
      })

      describe('timed out suite', () => {
        aroundAll(async (runSuite) => {
          console.log('>> outer aroundAll setup 0ms')
          await new Promise(r => setTimeout(r, 100))
          // this is still executed after timeout error
          console.log('>> outer aroundAll setup 100ms')
          // but this should not continue to inner aroundAll or tests
          await runSuite()
          console.log('>> outer aroundAll teardown')
        }, 10)

        aroundAll(async (runSuite) => {
          console.log('>> inner aroundAll setup')
          await runSuite()
          console.log('>> inner aroundAll teardown')
        })

        test('basic', () => {
          console.log('>> test')
        })
      })
    `,
  })

  expect(stderr).toMatchInlineSnapshot(`
    "
    ⎯⎯⎯⎯⎯⎯ Failed Suites 1 ⎯⎯⎯⎯⎯⎯⎯

     FAIL  late-run-suite-after-timeout.test.ts > timed out suite
    AroundHookSetupError: The setup phase of "aroundAll" hook timed out after 10ms.
     ❯ late-run-suite-after-timeout.test.ts:11:9
          9|
         10|       describe('timed out suite', () => {
         11|         aroundAll(async (runSuite) => {
           |         ^
         12|           console.log('>> outer aroundAll setup 0ms')
         13|           await new Promise(r => setTimeout(r, 100))

    ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯

    "
  `)
  expect(extractLogs(stdout)).toMatchInlineSnapshot(`
    ">> outer aroundAll setup 0ms
    >> afterAll 0ms
    >> outer aroundAll setup 100ms
    >> afterAll 200ms"
  `)
  expect(errorTree()).toMatchInlineSnapshot(`
    {
      "late-run-suite-after-timeout.test.ts": {
        "timed out suite": {
          "__suite_errors__": [
            "The setup phase of "aroundAll" hook timed out after 10ms.",
          ],
          "basic": "skipped",
        },
      },
    }
  `)
})

test('nested aroundEach setup error is not propagated to outer runTest catch', async () => {
  const { stdout, stderr, errorTree } = await runInlineTests({
    'nested-around-each-setup-error.test.ts': `
      import { aroundEach, test } from 'vitest'

      aroundEach(async (runTest) => {
        console.log('>> outer setup')
        try {
          await runTest()
        }
        catch (error) {
          console.log('>> outer caught', String(error))
        }
        console.log('>> outer teardown')
      })

      aroundEach(async (_runTest) => {
        console.log('>> inner setup')
        throw new Error('inner aroundEach setup error')
      })

      test('repro', () => {
        console.log('>> test body')
      })
    `,
  })

  expect(stderr).toMatchInlineSnapshot(`
    "
    ⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

     FAIL  nested-around-each-setup-error.test.ts > repro
    Error: inner aroundEach setup error
     ❯ nested-around-each-setup-error.test.ts:17:15
         15|       aroundEach(async (_runTest) => {
         16|         console.log('>> inner setup')
         17|         throw new Error('inner aroundEach setup error')
           |               ^
         18|       })
         19|
     ❯ nested-around-each-setup-error.test.ts:7:11

    ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯

    "
  `)
  expect(extractLogs(stdout)).toMatchInlineSnapshot(`
    ">> outer setup
    >> inner setup
    >> outer teardown"
  `)
  expect(errorTree()).toMatchInlineSnapshot(`
    {
      "nested-around-each-setup-error.test.ts": {
        "repro": [
          "inner aroundEach setup error",
        ],
      },
    }
  `)
})

test('nested aroundEach teardown error is not propagated to outer runTest catch', async () => {
  const { stdout, stderr, errorTree } = await runInlineTests({
    'nested-around-each-teardown-error.test.ts': `
      import { aroundEach, test } from 'vitest'

      aroundEach(async (runTest) => {
        console.log('>> outer setup')
        try {
          await runTest()
        }
        catch (error) {
          console.log('>> outer caught', String(error))
        }
        console.log('>> outer teardown')
      })

      aroundEach(async (runTest) => {
        console.log('>> inner setup')
        await runTest()
        console.log('>> inner teardown')
        throw new Error('inner aroundEach teardown error')
      })

      test('repro', () => {
        console.log('>> test body')
      })
    `,
  })

  expect(stderr).toMatchInlineSnapshot(`
    "
    ⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

     FAIL  nested-around-each-teardown-error.test.ts > repro
    Error: inner aroundEach teardown error
     ❯ nested-around-each-teardown-error.test.ts:19:15
         17|         await runTest()
         18|         console.log('>> inner teardown')
         19|         throw new Error('inner aroundEach teardown error')
           |               ^
         20|       })
         21|

    ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯

    "
  `)
  expect(extractLogs(stdout)).toMatchInlineSnapshot(`
    ">> outer setup
    >> inner setup
    >> test body
    >> inner teardown
    >> outer teardown"
  `)
  expect(errorTree()).toMatchInlineSnapshot(`
    {
      "nested-around-each-teardown-error.test.ts": {
        "repro": [
          "inner aroundEach teardown error",
        ],
      },
    }
  `)
})

test('nested aroundAll setup error is not propagated to outer runSuite catch', async () => {
  const { stdout, stderr, errorTree } = await runInlineTests({
    'nested-around-all-setup-error.test.ts': `
      import { aroundAll, test } from 'vitest'

      aroundAll(async (runSuite) => {
        console.log('>> outer setup')
        try {
          await runSuite()
        }
        catch (error) {
          console.log('>> outer caught', String(error))
        }
        console.log('>> outer teardown')
      })

      aroundAll(async (_runSuite) => {
        console.log('>> inner setup')
        throw new Error('inner aroundAll setup error')
      })

      test('repro', () => {
        console.log('>> test body')
      })
    `,
  })

  expect(stderr).toMatchInlineSnapshot(`
    "
    ⎯⎯⎯⎯⎯⎯ Failed Suites 1 ⎯⎯⎯⎯⎯⎯⎯

     FAIL  nested-around-all-setup-error.test.ts [ nested-around-all-setup-error.test.ts ]
    Error: inner aroundAll setup error
     ❯ nested-around-all-setup-error.test.ts:17:15
         15|       aroundAll(async (_runSuite) => {
         16|         console.log('>> inner setup')
         17|         throw new Error('inner aroundAll setup error')
           |               ^
         18|       })
         19|
     ❯ nested-around-all-setup-error.test.ts:7:11

    ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯

    "
  `)
  expect(extractLogs(stdout)).toMatchInlineSnapshot(`
    ">> outer setup
    >> inner setup
    >> outer teardown"
  `)
  expect(errorTree()).toMatchInlineSnapshot(`
    {
      "nested-around-all-setup-error.test.ts": {
        "__module_errors__": [
          "inner aroundAll setup error",
        ],
        "repro": "skipped",
      },
    }
  `)
})

test('nested aroundAll teardown error is not propagated to outer runSuite catch', async () => {
  const { stdout, stderr, errorTree } = await runInlineTests({
    'nested-around-all-teardown-error.test.ts': `
      import { aroundAll, test } from 'vitest'

      aroundAll(async (runSuite) => {
        console.log('>> outer setup')
        try {
          await runSuite()
        }
        catch (error) {
          console.log('>> outer caught', String(error))
        }
        console.log('>> outer teardown')
      })

      aroundAll(async (runSuite) => {
        console.log('>> inner setup')
        await runSuite()
        console.log('>> inner teardown')
        throw new Error('inner aroundAll teardown error')
      })

      test('repro', () => {
        console.log('>> test body')
      })
    `,
  })

  expect(stderr).toMatchInlineSnapshot(`
    "
    ⎯⎯⎯⎯⎯⎯ Failed Suites 1 ⎯⎯⎯⎯⎯⎯⎯

     FAIL  nested-around-all-teardown-error.test.ts [ nested-around-all-teardown-error.test.ts ]
    Error: inner aroundAll teardown error
     ❯ nested-around-all-teardown-error.test.ts:19:15
         17|         await runSuite()
         18|         console.log('>> inner teardown')
         19|         throw new Error('inner aroundAll teardown error')
           |               ^
         20|       })
         21|

    ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯

    "
  `)
  expect(extractLogs(stdout)).toMatchInlineSnapshot(`
    ">> outer setup
    >> inner setup
    >> test body
    >> inner teardown
    >> outer teardown"
  `)
  expect(errorTree()).toMatchInlineSnapshot(`
    {
      "nested-around-all-teardown-error.test.ts": {
        "__module_errors__": [
          "inner aroundAll teardown error",
        ],
        "repro": "passed",
      },
    }
  `)
})

test('three nested aroundEach teardown errors are all reported', async () => {
  const { stdout, stderr, errorTree } = await runInlineTests({
    'triple-around-each-teardown-errors.test.ts': `
      import { aroundEach, test } from 'vitest'

      aroundEach(async (runTest) => {
        console.log('>> outer setup')
        await runTest()
        console.log('>> outer teardown')
        throw new Error('outer aroundEach teardown error')
      })

      aroundEach(async (runTest) => {
        console.log('>> middle setup')
        await runTest()
        console.log('>> middle teardown')
        throw new Error('middle aroundEach teardown error')
      })

      aroundEach(async (runTest) => {
        console.log('>> inner setup')
        await runTest()
        console.log('>> inner teardown')
        throw new Error('inner aroundEach teardown error')
      })

      test('repro', () => {
        console.log('>> test body')
      })
    `,
  })

  expect(stderr).toMatchInlineSnapshot(`
    "
    ⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

     FAIL  triple-around-each-teardown-errors.test.ts > repro
    Error: inner aroundEach teardown error
     ❯ triple-around-each-teardown-errors.test.ts:22:15
         20|         await runTest()
         21|         console.log('>> inner teardown')
         22|         throw new Error('inner aroundEach teardown error')
           |               ^
         23|       })
         24|

    ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/3]⎯

     FAIL  triple-around-each-teardown-errors.test.ts > repro
    Error: middle aroundEach teardown error
     ❯ triple-around-each-teardown-errors.test.ts:15:15
         13|         await runTest()
         14|         console.log('>> middle teardown')
         15|         throw new Error('middle aroundEach teardown error')
           |               ^
         16|       })
         17|

    ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/3]⎯

     FAIL  triple-around-each-teardown-errors.test.ts > repro
    Error: outer aroundEach teardown error
     ❯ triple-around-each-teardown-errors.test.ts:8:15
          6|         await runTest()
          7|         console.log('>> outer teardown')
          8|         throw new Error('outer aroundEach teardown error')
           |               ^
          9|       })
         10|

    ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[3/3]⎯

    "
  `)
  expect(extractLogs(stdout)).toMatchInlineSnapshot(`
    ">> outer setup
    >> middle setup
    >> inner setup
    >> test body
    >> inner teardown
    >> middle teardown
    >> outer teardown"
  `)
  expect(errorTree()).toMatchInlineSnapshot(`
    {
      "triple-around-each-teardown-errors.test.ts": {
        "repro": [
          "inner aroundEach teardown error",
          "middle aroundEach teardown error",
          "outer aroundEach teardown error",
        ],
      },
    }
  `)
})

test('three nested aroundAll teardown errors are all reported', async () => {
  const { stdout, stderr, errorTree } = await runInlineTests({
    'triple-around-all-teardown-errors.test.ts': `
      import { aroundAll, test } from 'vitest'

      aroundAll(async (runSuite) => {
        console.log('>> outer setup')
        await runSuite()
        console.log('>> outer teardown')
        throw new Error('outer aroundAll teardown error')
      })

      aroundAll(async (runSuite) => {
        console.log('>> middle setup')
        await runSuite()
        console.log('>> middle teardown')
        throw new Error('middle aroundAll teardown error')
      })

      aroundAll(async (runSuite) => {
        console.log('>> inner setup')
        await runSuite()
        console.log('>> inner teardown')
        throw new Error('inner aroundAll teardown error')
      })

      test('repro', () => {
        console.log('>> test body')
      })
    `,
  })

  expect(stderr).toMatchInlineSnapshot(`
    "
    ⎯⎯⎯⎯⎯⎯ Failed Suites 1 ⎯⎯⎯⎯⎯⎯⎯

     FAIL  triple-around-all-teardown-errors.test.ts [ triple-around-all-teardown-errors.test.ts ]
    Error: inner aroundAll teardown error
     ❯ triple-around-all-teardown-errors.test.ts:22:15
         20|         await runSuite()
         21|         console.log('>> inner teardown')
         22|         throw new Error('inner aroundAll teardown error')
           |               ^
         23|       })
         24|

    ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/3]⎯

     FAIL  triple-around-all-teardown-errors.test.ts [ triple-around-all-teardown-errors.test.ts ]
    Error: middle aroundAll teardown error
     ❯ triple-around-all-teardown-errors.test.ts:15:15
         13|         await runSuite()
         14|         console.log('>> middle teardown')
         15|         throw new Error('middle aroundAll teardown error')
           |               ^
         16|       })
         17|

    ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/3]⎯

     FAIL  triple-around-all-teardown-errors.test.ts [ triple-around-all-teardown-errors.test.ts ]
    Error: outer aroundAll teardown error
     ❯ triple-around-all-teardown-errors.test.ts:8:15
          6|         await runSuite()
          7|         console.log('>> outer teardown')
          8|         throw new Error('outer aroundAll teardown error')
           |               ^
          9|       })
         10|

    ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[3/3]⎯

    "
  `)
  expect(extractLogs(stdout)).toMatchInlineSnapshot(`
    ">> outer setup
    >> middle setup
    >> inner setup
    >> test body
    >> inner teardown
    >> middle teardown
    >> outer teardown"
  `)
  expect(errorTree()).toMatchInlineSnapshot(`
    {
      "triple-around-all-teardown-errors.test.ts": {
        "__module_errors__": [
          "inner aroundAll teardown error",
          "middle aroundAll teardown error",
          "outer aroundAll teardown error",
        ],
        "repro": "passed",
      },
    }
  `)
})
