import { expect, test } from 'vitest'
import { runInlineTests } from '../../test-utils'

// Vitest tracks the current task only on Node 24 and later
const tracksCurrentTask = Number(process.versions.node.split('.')[0]) >= 24
const testWithTaskContext = test.runIf(tracksCurrentTask)

testWithTaskContext('attributes .resolves to its own concurrent test', async () => {
  const { errorTree } = await runInlineTests({
    'basic.test.ts': /* ts */ `
      import { expect, test } from 'vitest'

      const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
      const fetchUser = async () => {
        await sleep(50)
        return { name: 'bob' }
      }

      test.concurrent('a', async () => {
        await sleep(10)
        await expect(fetchUser()).resolves.toMatchObject({ name: 'alice' })
      })

      test.concurrent('b', async () => {
        await sleep(20)
      })
    `,
  })

  expect(errorTree()).toMatchInlineSnapshot(`
    {
      "basic.test.ts": {
        "a": [
          "expected { name: 'bob' } to match object { name: 'alice' }",
        ],
        "b": "passed",
      },
    }
  `)
})

testWithTaskContext('keeps a late .resolves of a timed out test out of the next test', async () => {
  const { stderr, errorTree } = await runInlineTests({
    'basic.test.ts': /* ts */ `
      import { expect, test } from 'vitest'

      const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
      const fetchUser = async () => {
        await sleep(300)
        return { name: 'bob' }
      }

      test('a', async () => {
        await sleep(100)
        await expect(fetchUser()).resolves.toMatchObject({ name: 'alice' })
      }, 50)

      test('b', async () => {
        await sleep(150)
      })
    `,
  })

  expect(stderr).toMatchInlineSnapshot(`
    "
    ⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

     FAIL  basic.test.ts > a
    TestTimeoutError: Test timed out in 50ms.
    If this is a long-running test, pass a timeout value as the last argument or configure it globally with "testTimeout".
     ❯ basic.test.ts:10:7
          8|       }
          9|
         10|       test('a', async () => {
           |       ^
         11|         await sleep(100)
         12|         await expect(fetchUser()).resolves.toMatchObject({ name: 'alic…

    ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯

    "
  `)
  expect(errorTree()).toMatchInlineSnapshot(`
    {
      "basic.test.ts": {
        "a": [
          "Test timed out in 50ms.
    If this is a long-running test, pass a timeout value as the last argument or configure it globally with "testTimeout".",
        ],
        "b": "passed",
      },
    }
  `)
})

testWithTaskContext(
  'attributes global onTestFinished and expect.soft to their own concurrent test',
  async () => {
    const { stderr, errorTree } = await runInlineTests({
      'basic.test.ts': /* ts */ `
      import { expect, onTestFinished, test } from 'vitest'

      const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

      test.concurrent('onTestFinished', async () => {
        await sleep(10)
        onTestFinished(() => {
          throw new Error('onTestFinished error')
        })
      })

      test.concurrent('expect.soft', async () => {
        await sleep(20)
        expect.soft(1).toBe(2)
      })

      test.concurrent('other', async () => {
        await sleep(50)
      })
    `,
    })

    expect(stderr).toMatchInlineSnapshot(`
    "
    ⎯⎯⎯⎯⎯⎯⎯ Failed Tests 2 ⎯⎯⎯⎯⎯⎯⎯

     FAIL  basic.test.ts > onTestFinished
    Error: onTestFinished error
     ❯ basic.test.ts:9:17
          7|         await sleep(10)
          8|         onTestFinished(() => {
          9|           throw new Error('onTestFinished error')
           |                 ^
         10|         })
         11|       })

    ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/2]⎯

     FAIL  basic.test.ts > expect.soft
    AssertionError: expected 1 to be 2 // Object.is equality

    - Expected
    + Received

    - 2
    + 1

     ❯ basic.test.ts:15:24
         13|       test.concurrent('expect.soft', async () => {
         14|         await sleep(20)
         15|         expect.soft(1).toBe(2)
           |                        ^
         16|       })
         17|

    ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/2]⎯

    "
  `)
    expect(errorTree()).toMatchInlineSnapshot(`
    {
      "basic.test.ts": {
        "expect.soft": [
          "expected 1 to be 2 // Object.is equality",
        ],
        "onTestFinished": [
          "onTestFinished error",
        ],
        "other": "passed",
      },
    }
  `)
  },
)

testWithTaskContext(
  'attributes what a test fixture starts to its test, and what a worker fixture starts to no test',
  async () => {
    const { stderr, errorTree } = await runInlineTests({
      'basic.test.ts': /* ts */ `
      import { expect, test as baseTest, TestRunner } from 'vitest'

      const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

      // a resource that keeps running after setup, such as a server or a watcher
      async function startTicker({}, { onCleanup }) {
        const ticker = { runningTest: 'not ticked yet' }
        const timer = setInterval(() => {
          ticker.runningTest = TestRunner.getCurrentTest()?.name
        })
        onCleanup(() => clearInterval(timer))
        return ticker
      }

      const test = baseTest
        .extend('testTicker', startTicker)
        .extend('workerTicker', { scope: 'worker' }, startTicker)

      for (const name of ['a', 'b']) {
        test(name, async ({ testTicker, workerTicker }) => {
          await sleep(20)
          expect(testTicker.runningTest).toBe(name)
          expect(workerTicker.runningTest).toBe(undefined)
        })
      }
    `,
    })

    expect(stderr).toBe('')
    expect(errorTree()).toMatchInlineSnapshot(`
    {
      "basic.test.ts": {
        "a": "passed",
        "b": "passed",
      },
    }
  `)
  },
)

testWithTaskContext('attributes what a suite hook starts to no test', async () => {
  const { stderr, errorTree } = await runInlineTests({
    'basic.test.ts': /* ts */ `
      import { beforeAll, describe, expect, test, TestRunner } from 'vitest'

      const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

      // a resource that keeps running after setup, such as a server or a watcher
      function startTicker() {
        const ticker = { runningTest: 'not ticked yet' }
        const timer = setInterval(() => {
          ticker.runningTest = TestRunner.getCurrentTest()?.name
        })
        ticker.stop = () => clearInterval(timer)
        return ticker
      }

      let fileTicker
      beforeAll(() => {
        fileTicker = startTicker()
        return fileTicker.stop
      })

      describe('suite', () => {
        let suiteTicker
        beforeAll(() => {
          suiteTicker = startTicker()
          return suiteTicker.stop
        })

        for (const name of ['a', 'b']) {
          test(name, async () => {
            await sleep(20)
            expect(fileTicker.runningTest).toBe(undefined)
            expect(suiteTicker.runningTest).toBe(undefined)
          })
        }
      })
    `,
  })

  expect(stderr).toBe('')
  expect(errorTree()).toMatchInlineSnapshot(`
    {
      "basic.test.ts": {
        "suite": {
          "a": "passed",
          "b": "passed",
        },
      },
    }
  `)
})

testWithTaskContext('attributes global snapshots to their own concurrent test', async () => {
  const { stderr, errorTree, fs } = await runInlineTests(
    {
      'basic.test.ts': /* ts */ `
      import { expect, test } from 'vitest'

      const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

      test.concurrent('a', async () => {
        await sleep(30)
        expect('a1').toMatchSnapshot()
        await sleep(30)
        expect('a2').toMatchSnapshot()
      })

      test.concurrent('b', async () => {
        await sleep(10)
        expect('b1').toMatchSnapshot()
        await sleep(30)
        expect('b2').toMatchSnapshot()
      })
    `,
    },
    { update: 'new' },
  )

  expect(stderr).toBe('')
  expect(errorTree()).toMatchInlineSnapshot(`
    {
      "basic.test.ts": {
        "a": "passed",
        "b": "passed",
      },
    }
  `)
  expect(fs.readFile('__snapshots__/basic.test.ts.snap')).toMatchInlineSnapshot(`
    "// Vitest Snapshot v1, https://vitest.dev/guide/snapshot.html

    exports[\`a 1\`] = \`"a1"\`;

    exports[\`a 2\`] = \`"a2"\`;

    exports[\`b 1\`] = \`"b1"\`;

    exports[\`b 2\`] = \`"b2"\`;
    "
  `)
})

function extractLogs(stdout: string) {
  // only which task each log belongs to matters, and the order across concurrent tasks isn't stable
  return [...stdout.matchAll(/^std(?:out|err) \| (.*)\n(.*)$/gm)]
    .map(([, task, log]) => `${task}: ${log}`)
    .sort()
}

const pools = ['forks', 'threads', 'vmForks', 'vmThreads']

testWithTaskContext.for(pools)(
  'attributes console output to its own concurrent test with %s',
  async (pool) => {
    const { stderr, stdout } = await runInlineTests(
      {
        'basic.test.ts': /* ts */ `
      import { test } from 'vitest'

      const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

      test.concurrent('a', async () => {
        await sleep(30)
        console.log('log a')
      })

      test.concurrent('b', async () => {
        await sleep(10)
        console.log('log b')
      })
    `,
      },
      { pool },
    )

    expect(stderr).toBe('')
    expect(extractLogs(stdout)).toMatchInlineSnapshot(`
    [
      "basic.test.ts > a: log a",
      "basic.test.ts > b: log b",
    ]
  `)
  },
)

testWithTaskContext(
  'attributes console output of suite hooks to their own concurrent suite',
  async () => {
    const { stderr, stdout } = await runInlineTests({
      'basic.test.ts': /* ts */ `
      import { afterAll, beforeAll, describe, test } from 'vitest'

      const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

      beforeAll(async () => {
        await sleep(10)
        console.log('beforeAll file')
      })
      afterAll(async () => {
        await sleep(10)
        console.log('afterAll file')
      })

      describe.concurrent('suites', () => {
        describe('x', () => {
          beforeAll(async () => {
            await sleep(30)
            console.log('beforeAll x')
          })
          afterAll(async () => {
            await sleep(30)
            console.log('afterAll x')
          })
          test('x1', async () => {
            await sleep(5)
          })
        })

        describe('y', () => {
          beforeAll(async () => {
            await sleep(10)
            console.log('beforeAll y')
          })
          afterAll(async () => {
            await sleep(10)
            console.log('afterAll y')
          })
          test('y1', async () => {
            await sleep(5)
          })
        })
      })
    `,
    })

    expect(stderr).toBe('')
    expect(extractLogs(stdout)).toMatchInlineSnapshot(`
    [
      "basic.test.ts > suites > x: afterAll x",
      "basic.test.ts > suites > x: beforeAll x",
      "basic.test.ts > suites > y: afterAll y",
      "basic.test.ts > suites > y: beforeAll y",
      "basic.test.ts: afterAll file",
      "basic.test.ts: beforeAll file",
    ]
  `)
  },
)

testWithTaskContext('attributes late console output to the test that timed out', async () => {
  const { stdout } = await runInlineTests({
    'basic.test.ts': /* ts */ `
      import { test } from 'vitest'

      const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

      test('a', async () => {
        await sleep(100)
        console.log('late log a')
      }, 50)

      test('b', async () => {
        await sleep(200)
      })
    `,
  })

  expect(extractLogs(stdout)).toMatchInlineSnapshot(`
    [
      "basic.test.ts > a: late log a",
    ]
  `)
})

testWithTaskContext.for(pools)(
  'names the concurrent test that caused an unhandled error with %s',
  async (pool) => {
    const { stderr } = await runInlineTests(
      {
        'basic.test.ts': /* ts */ `
      import { test } from 'vitest'

      const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

      test.concurrent('a', async () => {
        await sleep(10)
        Promise.reject(new Error('unhandled a'))
        await sleep(50)
      })

      test.concurrent('b', async () => {
        await sleep(100)
      })
    `,
      },
      { pool },
    )

    expect(
      stderr.match(/The last test to run before this error was .*/)?.[0],
    ).toMatchInlineSnapshot(`"The last test to run before this error was "a". This means either:"`)
  },
)

testWithTaskContext('counts global expect assertions on their own concurrent test', async () => {
  const { stderr, errorTree } = await runInlineTests(
    {
      'basic.test.ts': /* ts */ `
      import { expect, test } from 'vitest'

      const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

      test.concurrent('assertions', async () => {
        expect.assertions(1)
        await sleep(30)
        expect(1).toBe(1)
      })

      test.concurrent('hasAssertions', async () => {
        expect.hasAssertions()
        await sleep(20)
        expect(1).toBe(1)
      })

      test.concurrent('requireAssertions', async () => {
        await sleep(40)
      })

      test.concurrent('currentTestName', async () => {
        await sleep(10)
        expect(expect.getState().currentTestName).toBe('currentTestName')
        expect(1).toBe(1)
      })

      test.concurrent('mixed with local expect', async ({ expect: localExpect }) => {
        expect.assertions(2)
        await sleep(10)
        expect(1).toBe(1)
        localExpect(1).toBe(1)
      })
    `,
    },
    { expect: { requireAssertions: true } },
  )

  expect(stderr).toMatchInlineSnapshot(`
    "
    ⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

     FAIL  basic.test.ts > requireAssertions
    Error: expected any number of assertion, but got none
     ❯ basic.test.ts:18:12
         16|       })
         17|
         18|       test.concurrent('requireAssertions', async () => {
           |            ^
         19|         await sleep(40)
         20|       })

    ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯

    "
  `)
  expect(errorTree()).toMatchInlineSnapshot(`
    {
      "basic.test.ts": {
        "assertions": "passed",
        "currentTestName": "passed",
        "hasAssertions": "passed",
        "mixed with local expect": "passed",
        "requireAssertions": [
          "expected any number of assertion, but got none",
        ],
      },
    }
  `)
})

testWithTaskContext(
  'passes global expect state to matchers of their own concurrent test',
  async () => {
    const { stderr, errorTree } = await runInlineTests({
      'basic.test.ts': /* ts */ `
      import { expect, test } from 'vitest'

      const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

      expect.extend({
        toSeeState(received, flag, assertionCalls) {
          const actual = { flag: this.flag, assertionCalls: this.assertionCalls }
          return {
            pass: this.equals(actual, { flag, assertionCalls }),
            message: () => \`state is \${JSON.stringify(actual)}\`,
          }
        },
      })

      test.concurrent('a', async () => {
        expect.setState({ flag: 'a' })
        await sleep(20)
        expect(0).toSeeState('a', 1)
        expect(0).toEqual(expect.toSeeState('a', 2))
      })

      test.concurrent('b', async () => {
        expect.setState({ flag: 'b' })
        await sleep(10)
        expect(0).toSeeState('b', 1)
        expect(0).toEqual(expect.toSeeState('b', 2))
      })
    `,
    })

    expect(stderr).toBe('')
    expect(errorTree()).toMatchInlineSnapshot(`
    {
      "basic.test.ts": {
        "a": "passed",
        "b": "passed",
      },
    }
  `)
  },
)

test.skipIf(tracksCurrentTask)('falls back to the last started test on Node 22', async () => {
  const { stderr, stdout } = await runInlineTests({
    'basic.test.ts': /* ts */ `
      import { test } from 'vitest'

      const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

      test.concurrent('a', async () => {
        await sleep(30)
        console.log('log a')
      })

      test.concurrent('b', async () => {
        await sleep(10)
        console.log('log b')
      })
    `,
  })

  expect(stderr).toBe('')
  expect(extractLogs(stdout)).toMatchInlineSnapshot(`
    [
      "basic.test.ts > b: log b",
      "basic.test.ts: log a",
    ]
  `)
})

test.skipIf(tracksCurrentTask)(
  'keeps expect.setState of a test for the next test on Node 22',
  async () => {
    const { stderr, testTree } = await runInlineTests({
      'basic.test.ts': /* ts */ `
      import { expect, test } from 'vitest'

      test('a', () => {
        expect.setState({ custom: 1 })
      })

      test('b', () => {
        expect(expect.getState().custom).toBe(1)
      })
    `,
    })

    expect(stderr).toBe('')
    expect(testTree()).toMatchInlineSnapshot(`
    {
      "basic.test.ts": {
        "a": "passed",
        "b": "passed",
      },
    }
  `)
  },
)
