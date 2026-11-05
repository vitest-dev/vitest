import { expect, test } from 'vitest'
import { runInlineTests } from '../../test-utils'

test('attributes .resolves to its own concurrent test', async () => {
  const { stderr, errorTree } = await runInlineTests({
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

  expect(stderr).toMatchInlineSnapshot(`
    "
    ⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

     FAIL  basic.test.ts > a
    AssertionError: expected { name: 'bob' } to match object { name: 'alice' }

    - Expected
    + Received

      {
    -   "name": "alice",
    +   "name": "bob",
      }

     ❯ basic.test.ts:12:34
         10|       test.concurrent('a', async () => {
         11|         await sleep(10)
         12|         await expect(fetchUser()).resolves.toMatchObject({ name: 'alic…
           |                                  ^
         13|       })
         14|

    ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯

    "
  `)
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

test('does not attribute callbacks of a worker fixture to the first test that used it', async () => {
  const { stderr, errorTree } = await runInlineTests({
    'basic.test.ts': /* ts */ `
      import { expect, test as baseTest } from 'vitest'

      expect.extend({
        toBeInTest(_received, name) {
          return {
            pass: this.task?.name === name,
            message: () => \`expected to be in test "\${name}", but was in "\${this.task?.name}"\`,
          }
        },
      })

      const test = baseTest.extend('server', { scope: 'worker' }, async ({}, { onCleanup }) => {
        const queue = []
        let wake = () => {}
        let running = true
        const loop = (async () => {
          while (running) {
            await new Promise((resolve) => (wake = resolve))
            while (queue.length) {
              queue.shift()()
            }
          }
        })()
        onCleanup(async () => {
          running = false
          wake()
          await loop
        })
        return {
          request: (handler) =>
            new Promise((resolve, reject) => {
              queue.push(() => {
                try {
                  resolve(handler())
                } catch (error) {
                  reject(error)
                }
              })
              wake()
            }),
        }
      })

      test('a', async ({ server }) => {
        await server.request(() => expect(null).toBeInTest('a'))
      })

      test('b', async ({ server }) => {
        await server.request(() => expect(null).toBeInTest('b'))
      })
    `,
  })

  expect(stderr).toMatchInlineSnapshot(`""`)
  expect(errorTree()).toMatchInlineSnapshot(`
    {
      "basic.test.ts": {
        "a": "passed",
        "b": "passed",
      },
    }
  `)
})

test.for(['vmThreads', 'vmForks'])(
  'attributes .resolves to its own concurrent test in %s',
  async (pool) => {
    const { stderr, errorTree } = await runInlineTests(
      {
        'basic.test.ts': /* ts */ `
      import { expect, test } from 'vitest'

      const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

      test.concurrent('a', async () => {
        await sleep(10)
        await expect(sleep(50).then(() => 'bob')).resolves.toBe('alice')
      })

      test.concurrent('b', async () => {
        await sleep(20)
      })
    `,
      },
      { pool },
    )

    expect(stderr).toMatchInlineSnapshot(`
    "
    ⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

     FAIL  basic.test.ts > a
    AssertionError: expected 'bob' to be 'alice' // Object.is equality

    Expected: "alice"
    Received: "bob"

     ❯ basic.test.ts:8:50
          6|       test.concurrent('a', async () => {
          7|         await sleep(10)
          8|         await expect(sleep(50).then(() => 'bob')).resolves.toBe('alice…
           |                                                  ^
          9|       })
         10|

    ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯

    "
  `)
    expect(errorTree()).toMatchInlineSnapshot(`
    {
      "basic.test.ts": {
        "a": [
          "expected 'bob' to be 'alice' // Object.is equality",
        ],
        "b": "passed",
      },
    }
  `)
  },
)
