import { expect, test } from 'vitest'
import { runInlineTests } from '../../test-utils'

test('attributes .resolves to its own concurrent test', async () => {
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

test('attributes .resolves to the test that timed out', async () => {
  const { stderr, errorTree } = await runInlineTests({
    'basic.test.ts': /* ts */ `
      import { expect, test } from 'vitest'

      const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
      const fetchUser = async () => {
        await sleep(200)
        return { name: 'bob' }
      }

      test('a', async () => {
        await sleep(100)
        await expect(fetchUser()).resolves.toMatchObject({ name: 'alice' })
      }, 50)

      test('b', async () => {
        await sleep(400)
      })
    `,
  })

  expect(stderr).toMatchInlineSnapshot(`
    "
    ⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

     FAIL  basic.test.ts > a
    Error: Test timed out in 50ms.
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

test('attributes global onTestFinished and expect.soft to their own concurrent test', async () => {
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
})

test('attributes what a fixture starts to the test that set it up', async () => {
  const { stderr, errorTree } = await runInlineTests({
    'basic.test.ts': /* ts */ `
      import { expect, test as baseTest, TestRunner } from 'vitest'

      const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

      // a resource that keeps running after setup, such as a server or a watcher
      async function startTicker({}, { onCleanup }) {
        const ticker = { runningTest: undefined }
        const timer = setInterval(() => {
          ticker.runningTest = TestRunner.getCurrentTest()?.name
        })
        onCleanup(() => clearInterval(timer))
        return ticker
      }

      const test = baseTest
        .extend('testTicker', startTicker)
        .extend('workerTicker', { scope: 'worker' }, startTicker)

      test('a', async ({ testTicker, workerTicker }) => {
        await sleep(20)
        expect(testTicker.runningTest).toBe('a')
        expect(workerTicker.runningTest).toBe('a')
      })

      test('b', async ({ testTicker, workerTicker }) => {
        await sleep(20)
        expect(testTicker.runningTest).toBe('b')
        // A worker fixture keeps the context of the test that first set it up.
        // Setting it up outside any context would make this fall back to the
        // global slot instead, which is no more accurate with concurrent tests,
        // so it's left as a possible follow-up.
        expect(workerTicker.runningTest).toBe('a')
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
})

test('attributes global snapshots to their own concurrent test', async () => {
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
  return [...stdout.matchAll(/^std(?:out|err) \| (.*)\n(.*)$/gm)]
    .map(([, task, log]) => `${task}: ${log}`)
    .sort()
}

test('attributes console output to its own concurrent test', async () => {
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
      "basic.test.ts > a: log a",
      "basic.test.ts > b: log b",
    ]
  `)
})

test('attributes console output of suite hooks to their own concurrent suite', async () => {
  const { stderr, stdout } = await runInlineTests({
    'basic.test.ts': /* ts */ `
      import { afterAll, beforeAll, describe, test } from 'vitest'

      const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

      beforeAll(() => {
        console.log('beforeAll file')
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
      "basic.test.ts: beforeAll file",
    ]
  `)
})

test('attributes late console output to the test that timed out', async () => {
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

test('names the concurrent test that caused an unhandled error', async () => {
  const { stderr } = await runInlineTests({
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
  })

  expect(stderr.match(/The last test to run before this error was .*/)?.[0]).toMatchInlineSnapshot(
    `"The last test to run before this error was "a". This means either:"`,
  )
})
