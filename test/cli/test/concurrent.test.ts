import { expect, test } from 'vitest'
import { runInlineTests } from '../../test-utils'

// 3 tests depend on each other,
// so they will deadlock when maxConcurrency < 3
//
//  [a]  [b]  [c]
//   * ->
//        * ->
//          <- *
//     <------

const deadlockSource = `
import { describe, expect, test } from 'vitest'
import { createDefer } from '@vitest/utils/helpers'

describe.concurrent('wrapper', () => {
  const defers = [
    createDefer<void>(),
    createDefer<void>(),
    createDefer<void>(),
  ]

  test('a', async () => {
    expect(1).toBe(1)
    defers[0].resolve()
    await defers[2]
  })

  test('b', async () => {
    expect(1).toBe(1)
    await defers[0]
    defers[1].resolve()
    await defers[2]
  })

  test('c', async () => {
    expect(1).toBe(1)
    await defers[1]
    defers[2].resolve()
  })
})
`

const suiteDeadlockSource = `
import { describe, expect, test } from 'vitest'
import { createDefer } from '@vitest/utils/helpers'

describe.concurrent('wrapper', () => {
  const defers = [
    createDefer<void>(),
    createDefer<void>(),
    createDefer<void>(),
  ]

  describe('1st suite', () => {
    test('a', async () => {
      expect(1).toBe(1)
      defers[0].resolve()
      await defers[2]
    })

    test('b', async () => {
      expect(1).toBe(1)
      await defers[0]
      defers[1].resolve()
      await defers[2]
    })
  })

  describe('2nd suite', () => {
    test('c', async () => {
      expect(1).toBe(1)
      await defers[1]
      defers[2].resolve()
    })
  })
})
`

test('deadlocks with insufficient maxConcurrency', async () => {
  const { errorTree } = await runInlineTests({
    'basic.test.ts': deadlockSource,
  }, {
    maxConcurrency: 2,
    testTimeout: 1000,
  })

  // "a" and "b" fill both concurrency slots and wait for `defers[2]`.
  // "c" is queued until one slot is released by timeout, then it starts,
  // observes `defers[1]` already resolved by "b", resolves `defers[2]`, and passes.
  expect(errorTree()).toMatchInlineSnapshot(`
    {
      "basic.test.ts": {
        "wrapper": {
          "a": [
            "Test timed out in 1000ms.
    If this is a long-running test, pass a timeout value as the last argument or configure it globally with "testTimeout".",
          ],
          "b": [
            "Test timed out in 1000ms.
    If this is a long-running test, pass a timeout value as the last argument or configure it globally with "testTimeout".",
          ],
          "c": "passed",
        },
      },
    }
  `)
})

test('passes when maxConcurrency is high enough', async () => {
  const { stderr, errorTree } = await runInlineTests({
    'basic.test.ts': deadlockSource,
  }, {
    maxConcurrency: 3,
  })

  expect(stderr).toBe('')
  expect(errorTree()).toMatchInlineSnapshot(`
    {
      "basic.test.ts": {
        "wrapper": {
          "a": "passed",
          "b": "passed",
          "c": "passed",
        },
      },
    }
  `)
})

test('suite deadlocks with insufficient maxConcurrency', async () => {
  const { errorTree } = await runInlineTests({
    'basic.test.ts': suiteDeadlockSource,
  }, {
    maxConcurrency: 2,
    testTimeout: 1000,
  })

  expect(errorTree()).toMatchInlineSnapshot(`
    {
      "basic.test.ts": {
        "wrapper": {
          "1st suite": {
            "a": [
              "Test timed out in 1000ms.
    If this is a long-running test, pass a timeout value as the last argument or configure it globally with "testTimeout".",
            ],
            "b": [
              "Test timed out in 1000ms.
    If this is a long-running test, pass a timeout value as the last argument or configure it globally with "testTimeout".",
            ],
          },
          "2nd suite": {
            "c": "passed",
          },
        },
      },
    }
  `)
})

test('suite passes when maxConcurrency is high enough', async () => {
  const { stderr, errorTree } = await runInlineTests({
    'basic.test.ts': suiteDeadlockSource,
  }, {
    maxConcurrency: 3,
  })

  expect(stderr).toBe('')
  expect(errorTree()).toMatchInlineSnapshot(`
    {
      "basic.test.ts": {
        "wrapper": {
          "1st suite": {
            "a": "passed",
            "b": "passed",
          },
          "2nd suite": {
            "c": "passed",
          },
        },
      },
    }
  `)
})
