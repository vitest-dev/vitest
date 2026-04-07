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

test('deadlocks with insufficient maxConcurrency', async () => {
  const { errorTree } = await runInlineTests({
    'basic.test.ts': deadlockSource,
  }, {
    maxConcurrency: 2,
    testTimeout: 500,
  })

  // "a" and "b" fill both concurrency slots and wait for `defers[2]`.
  // "c" is queued until one slot is released by timeout, then it starts,
  // observes `defers[1]` already resolved by "b", resolves `defers[2]`, and passes.
  expect(errorTree()).toMatchInlineSnapshot(`
    {
      "basic.test.ts": {
        "wrapper": {
          "a": [
            "Test timed out in 500ms.
    If this is a long-running test, pass a timeout value as the last argument or configure it globally with "testTimeout".",
          ],
          "b": [
            "Test timed out in 500ms.
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

test('suite deadlocks with insufficient maxConcurrency', async () => {
  const { errorTree } = await runInlineTests({
    'basic.test.ts': suiteDeadlockSource,
  }, {
    maxConcurrency: 2,
    testTimeout: 500,
  })

  expect(errorTree()).toMatchInlineSnapshot(`
    {
      "basic.test.ts": {
        "wrapper": {
          "1st suite": {
            "a": [
              "Test timed out in 500ms.
    If this is a long-running test, pass a timeout value as the last argument or configure it globally with "testTimeout".",
            ],
            "b": [
              "Test timed out in 500ms.
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

const beforeAllNeighboringSuitesSource = `
import { beforeAll, describe, expect, test } from 'vitest'
import { createDefer } from '@vitest/utils/helpers'

const defers = [
  createDefer<void>(),
  createDefer<void>(),
]

describe.concurrent('s1', () => {
  beforeAll(async () => {
    defers[0].resolve()
    await defers[1]
  })

  test('a', () => {
    expect(1).toBe(1)
  })
})

describe.concurrent('s2', () => {
  beforeAll(async () => {
    await defers[0]
    defers[1].resolve()
  })

  test('b', () => {
    expect(1).toBe(1)
  })
})
`

test('neighboring suite beforeAll deadlocks with insufficient maxConcurrency', async () => {
  const { errorTree } = await runInlineTests({
    'basic.test.ts': beforeAllNeighboringSuitesSource,
  }, {
    maxConcurrency: 1,
    hookTimeout: 500,
  })

  expect(errorTree()).toMatchInlineSnapshot(`
    {
      "basic.test.ts": {
        "s1": {
          "__suite_errors__": [
            "Hook timed out in 500ms.
    If this is a long-running hook, pass a timeout value as the last argument or configure it globally with "hookTimeout".",
          ],
          "a": "skipped",
        },
        "s2": {
          "b": "passed",
        },
      },
    }
  `)
})

test('neighboring suite beforeAll passes when maxConcurrency is high enough', async () => {
  const { stderr, errorTree } = await runInlineTests({
    'basic.test.ts': beforeAllNeighboringSuitesSource,
  }, {
    maxConcurrency: 2,
  })

  expect(stderr).toBe('')
  expect(errorTree()).toMatchInlineSnapshot(`
    {
      "basic.test.ts": {
        "s1": {
          "a": "passed",
        },
        "s2": {
          "b": "passed",
        },
      },
    }
  `)
})

const afterAllNeighboringSuitesSource = `
import { afterAll, describe, expect, test } from 'vitest'
import { createDefer } from '@vitest/utils/helpers'

const defers = [
  createDefer<void>(),
  createDefer<void>(),
]

describe.concurrent('s1', () => {
  afterAll(async () => {
    defers[0].resolve()
    await defers[1]
  })

  test('a', () => {
    expect(1).toBe(1)
  })
})

describe.concurrent('s2', () => {
  afterAll(async () => {
    await defers[0]
    defers[1].resolve()
  })

  test('b', () => {
    expect(1).toBe(1)
  })
})
`

test('neighboring suite afterAll deadlocks with insufficient maxConcurrency', async () => {
  const { errorTree } = await runInlineTests({
    'basic.test.ts': afterAllNeighboringSuitesSource,
  }, {
    maxConcurrency: 1,
    hookTimeout: 500,
  })

  expect(errorTree()).toMatchInlineSnapshot(`
    {
      "basic.test.ts": {
        "s1": {
          "__suite_errors__": [
            "Hook timed out in 500ms.
    If this is a long-running hook, pass a timeout value as the last argument or configure it globally with "hookTimeout".",
          ],
          "a": "passed",
        },
        "s2": {
          "b": "passed",
        },
      },
    }
  `)
})

test('neighboring suite afterAll passes when maxConcurrency is high enough', async () => {
  const { stderr, errorTree } = await runInlineTests({
    'basic.test.ts': afterAllNeighboringSuitesSource,
  }, {
    maxConcurrency: 2,
  })

  expect(stderr).toBe('')
  expect(errorTree()).toMatchInlineSnapshot(`
    {
      "basic.test.ts": {
        "s1": {
          "a": "passed",
        },
        "s2": {
          "b": "passed",
        },
      },
    }
  `)
})

const beforeEachDeadlockSource = `
import { beforeEach, describe, expect, test } from 'vitest'
import { createDefer } from '@vitest/utils/helpers'

describe.concurrent('wrapper', () => {
  const defers = [
    createDefer<void>(),
    createDefer<void>(),
    createDefer<void>(),
  ]

  beforeEach(async () => {
    defers[0].resolve()
    await defers[2]
  })

  beforeEach(async () => {
    await defers[0]
    defers[1].resolve()
    await defers[2]
  })

  beforeEach(async () => {
    await defers[1]
    defers[2].resolve()
  })

  test('t', () => {
    expect(1).toBe(1)
  })
})
`

test('beforeEach deadlocks with insufficient maxConcurrency', async () => {
  const { errorTree } = await runInlineTests({
    'basic.test.ts': beforeEachDeadlockSource,
  }, {
    maxConcurrency: 2,
    sequence: { hooks: 'parallel' },
    hookTimeout: 500,
  })

  expect(errorTree()).toMatchInlineSnapshot(`
    {
      "basic.test.ts": {
        "wrapper": {
          "t": [
            "Hook timed out in 500ms.
    If this is a long-running hook, pass a timeout value as the last argument or configure it globally with "hookTimeout".",
          ],
        },
      },
    }
  `)
})

test('beforeEach passes when maxConcurrency is high enough', async () => {
  const { stderr, errorTree } = await runInlineTests({
    'basic.test.ts': beforeEachDeadlockSource,
  }, {
    maxConcurrency: 3,
    sequence: { hooks: 'parallel' },
  })

  expect(stderr).toBe('')
  expect(errorTree()).toMatchInlineSnapshot(`
    {
      "basic.test.ts": {
        "wrapper": {
          "t": "passed",
        },
      },
    }
  `)
})

const afterEachDeadlockSource = `
import { afterEach, describe, expect, test } from 'vitest'
import { createDefer } from '@vitest/utils/helpers'

describe.concurrent('wrapper', () => {
  const defers = [
    createDefer<void>(),
    createDefer<void>(),
    createDefer<void>(),
  ]

  afterEach(async () => {
    defers[0].resolve()
    await defers[2]
  })

  afterEach(async () => {
    await defers[0]
    defers[1].resolve()
    await defers[2]
  })

  afterEach(async () => {
    await defers[1]
    defers[2].resolve()
  })

  test('t', () => {
    expect(1).toBe(1)
  })
})
`

test('afterEach deadlocks with insufficient maxConcurrency', async () => {
  const { errorTree } = await runInlineTests({
    'basic.test.ts': afterEachDeadlockSource,
  }, {
    maxConcurrency: 2,
    sequence: { hooks: 'parallel' },
    hookTimeout: 500,
  })

  expect(errorTree()).toMatchInlineSnapshot(`
    {
      "basic.test.ts": {
        "wrapper": {
          "t": [
            "Hook timed out in 500ms.
    If this is a long-running hook, pass a timeout value as the last argument or configure it globally with "hookTimeout".",
          ],
        },
      },
    }
  `)
})

test('afterEach passes when maxConcurrency is high enough', async () => {
  const { stderr, errorTree } = await runInlineTests({
    'basic.test.ts': afterEachDeadlockSource,
  }, {
    maxConcurrency: 3,
    sequence: { hooks: 'parallel' },
  })

  expect(stderr).toBe('')
  expect(errorTree()).toMatchInlineSnapshot(`
    {
      "basic.test.ts": {
        "wrapper": {
          "t": "passed",
        },
      },
    }
  `)
})

const aroundAllNeighboringSuitesSource = `
import { aroundAll, describe, expect, test } from 'vitest'
import { createDefer } from '@vitest/utils/helpers'

const defers = [
  createDefer<void>(),
  createDefer<void>(),
]

describe.concurrent('s1', () => {
  aroundAll(async (runSuite) => {
    defers[0].resolve()
    await defers[1]
    await runSuite()
  })

  test('a', () => {
    expect(1).toBe(1)
  })
})

describe.concurrent('s2', () => {
  aroundAll(async (runSuite) => {
    await defers[0]
    defers[1].resolve()
    await runSuite()
  })

  test('b', () => {
    expect(1).toBe(1)
  })
})
`

test('neighboring suite aroundAll deadlocks with insufficient maxConcurrency', async () => {
  const { errorTree } = await runInlineTests({
    'basic.test.ts': aroundAllNeighboringSuitesSource,
  }, {
    maxConcurrency: 1,
    hookTimeout: 500,
  })

  expect(errorTree()).toMatchInlineSnapshot(`
    {
      "basic.test.ts": {
        "s1": {
          "__suite_errors__": [
            "The setup phase of "aroundAll" hook timed out after 500ms.",
          ],
          "a": "skipped",
        },
        "s2": {
          "b": "passed",
        },
      },
    }
  `)
})

test('neighboring suite aroundAll passes when maxConcurrency is high enough', async () => {
  const { stderr, errorTree } = await runInlineTests({
    'basic.test.ts': aroundAllNeighboringSuitesSource,
  }, {
    maxConcurrency: 2,
  })

  expect(stderr).toBe('')
  expect(errorTree()).toMatchInlineSnapshot(`
    {
      "basic.test.ts": {
        "s1": {
          "a": "passed",
        },
        "s2": {
          "b": "passed",
        },
      },
    }
  `)
})

const aroundAllNeighboringSuitesPostSource = `
import { aroundAll, describe, expect, test } from 'vitest'
import { createDefer } from '@vitest/utils/helpers'

const defers = [
  createDefer<void>(),
  createDefer<void>(),
]

describe.concurrent('s1', () => {
  aroundAll(async (runSuite) => {
    await runSuite()
    defers[0].resolve()
    await defers[1]
  })

  test('a', () => {
    expect(1).toBe(1)
  })
})

describe.concurrent('s2', () => {
  aroundAll(async (runSuite) => {
    await runSuite()
    await defers[0]
    defers[1].resolve()
  })

  test('b', () => {
    expect(1).toBe(1)
  })
})
`

test('neighboring suite aroundAll teardown deadlocks with insufficient maxConcurrency', async () => {
  const { errorTree } = await runInlineTests({
    'basic.test.ts': aroundAllNeighboringSuitesPostSource,
  }, {
    maxConcurrency: 1,
    hookTimeout: 500,
  })

  expect(errorTree()).toMatchInlineSnapshot(`
    {
      "basic.test.ts": {
        "s1": {
          "__suite_errors__": [
            "The teardown phase of \"aroundAll\" hook timed out after 500ms.",
          ],
          "a": "passed",
        },
        "s2": {
          "b": "passed",
        },
      },
    }
  `)
})

test('neighboring suite aroundAll teardown passes when maxConcurrency is high enough', async () => {
  const { stderr, errorTree } = await runInlineTests({
    'basic.test.ts': aroundAllNeighboringSuitesPostSource,
  }, {
    maxConcurrency: 2,
  })

  expect(stderr).toBe('')
  expect(errorTree()).toMatchInlineSnapshot(`
    {
      "basic.test.ts": {
        "s1": {
          "a": "passed",
        },
        "s2": {
          "b": "passed",
        },
      },
    }
  `)
})

const aroundAllSetupTimeoutLateTeardownAcquireSource = `
import { aroundAll, describe, expect, test } from 'vitest'
import { createDefer } from '@vitest/utils/helpers'

const unblockS1Setup = createDefer<void>()
const allowS2TestFinish = createDefer<void>()
const blockForever = createDefer<void>()

describe.concurrent('s1', () => {
  aroundAll(async (runSuite) => {
    await unblockS1Setup
    await runSuite()
    allowS2TestFinish.resolve()
    await blockForever
  })

  test('a', () => {
    expect(1).toBe(1)
  })
})

describe.concurrent('s2', () => {
  aroundAll(async (runSuite) => {
    unblockS1Setup.resolve()
    await runSuite()
  })

  test('b', async () => {
    await allowS2TestFinish
    expect(1).toBe(1)
  })
})
`

test('neighboring suite aroundAll does not hang when setup times out before late teardown acquire', async () => {
  const { errorTree } = await runInlineTests({
    'basic.test.ts': aroundAllSetupTimeoutLateTeardownAcquireSource,
  }, {
    maxConcurrency: 1,
    hookTimeout: 500,
    testTimeout: 500,
  })

  expect(errorTree()).toMatchInlineSnapshot(`
    {
      "basic.test.ts": {
        "s1": {
          "__suite_errors__": [
            "The setup phase of "aroundAll" hook timed out after 500ms.",
          ],
          "a": "skipped",
        },
        "s2": {
          "b": [
            "Test timed out in 500ms.
    If this is a long-running test, pass a timeout value as the last argument or configure it globally with "testTimeout".",
          ],
        },
      },
    }
  `)
})

const aroundEachNeighboringTestsSource = `
import { aroundEach, describe, expect, test } from 'vitest'
import { createDefer } from '@vitest/utils/helpers'

const defers = [
  createDefer<void>(),
  createDefer<void>(),
]

describe.concurrent('wrapper', () => {
  aroundEach(async (runTest, context) => {
    if (context.task.name === 'a') {
      defers[0].resolve()
      await defers[1]
      await runTest()
      return
    }

    await defers[0]
    defers[1].resolve()
    await runTest()
  })

  test('a', () => {
    expect(1).toBe(1)
  })

  test('b', () => {
    expect(1).toBe(1)
  })
})
`

test('neighboring test aroundEach deadlocks with insufficient maxConcurrency', async () => {
  const { errorTree } = await runInlineTests({
    'basic.test.ts': aroundEachNeighboringTestsSource,
  }, {
    maxConcurrency: 1,
    hookTimeout: 500,
  })

  expect(errorTree()).toMatchInlineSnapshot(`
    {
      "basic.test.ts": {
        "wrapper": {
          "a": [
            "The setup phase of \"aroundEach\" hook timed out after 500ms.",
          ],
          "b": "passed",
        },
      },
    }
  `)
})

test('neighboring test aroundEach passes when maxConcurrency is high enough', async () => {
  const { stderr, errorTree } = await runInlineTests({
    'basic.test.ts': aroundEachNeighboringTestsSource,
  }, {
    maxConcurrency: 2,
  })

  expect(stderr).toBe('')
  expect(errorTree()).toMatchInlineSnapshot(`
    {
      "basic.test.ts": {
        "wrapper": {
          "a": "passed",
          "b": "passed",
        },
      },
    }
  `)
})

const aroundEachNeighboringTestsPostSource = `
import { aroundEach, describe, expect, test } from 'vitest'
import { createDefer } from '@vitest/utils/helpers'

const defers = [
  createDefer<void>(),
  createDefer<void>(),
]

describe.concurrent('wrapper', () => {
  aroundEach(async (runTest, context) => {
    await runTest()

    if (context.task.name === 'a') {
      defers[0].resolve()
      await defers[1]
      return
    }

    await defers[0]
    defers[1].resolve()
  })

  test('a', () => {
    expect(1).toBe(1)
  })

  test('b', () => {
    expect(1).toBe(1)
  })
})
`

test('neighboring test aroundEach teardown deadlocks with insufficient maxConcurrency', async () => {
  const { errorTree } = await runInlineTests({
    'basic.test.ts': aroundEachNeighboringTestsPostSource,
  }, {
    maxConcurrency: 1,
    hookTimeout: 500,
  })

  expect(errorTree()).toMatchInlineSnapshot(`
    {
      "basic.test.ts": {
        "wrapper": {
          "a": [
            "The teardown phase of \"aroundEach\" hook timed out after 500ms.",
          ],
          "b": "passed",
        },
      },
    }
  `)
})

test('neighboring test aroundEach teardown passes when maxConcurrency is high enough', async () => {
  const { stderr, errorTree } = await runInlineTests({
    'basic.test.ts': aroundEachNeighboringTestsPostSource,
  }, {
    maxConcurrency: 2,
  })

  expect(stderr).toBe('')
  expect(errorTree()).toMatchInlineSnapshot(`
    {
      "basic.test.ts": {
        "wrapper": {
          "a": "passed",
          "b": "passed",
        },
      },
    }
  `)
})

const aroundEachOuterCatchesInnerErrorSource = `
import { aroundEach, describe, expect, test } from 'vitest'

describe.concurrent('wrapper', () => {
  aroundEach(async (runTest) => {
    let runTestError: unknown
    try {
      await runTest()
    }
    catch (error) {
      runTestError = error
    }

    await Promise.resolve()

    if (runTestError) {
      throw runTestError
    }
  })

  aroundEach(async (runTest, context) => {
    await runTest()
    if (context.task.name === 'a') {
      throw new Error('inner aroundEach teardown failure')
    }
  })

  test('a', () => {
    expect(1).toBe(1)
  })

  test('b', () => {
    expect(1).toBe(1)
  })
})
`

test('aroundEach continues protocol when outer hook catches runTest error', async () => {
  const { errorTree } = await runInlineTests({
    'basic.test.ts': aroundEachOuterCatchesInnerErrorSource,
  }, {
    maxConcurrency: 1,
  })

  expect(errorTree()).toMatchInlineSnapshot(`
    {
      "basic.test.ts": {
        "wrapper": {
          "a": [
            "inner aroundEach teardown failure",
          ],
          "b": "passed",
        },
      },
    }
  `)
})

const aroundAllOuterCatchesInnerErrorSource = `
import { aroundAll, describe, expect, test } from 'vitest'

describe.concurrent('suite', () => {
  aroundAll(async (runSuite) => {
    let runSuiteError: unknown
    try {
      await runSuite()
    }
    catch (error) {
      runSuiteError = error
    }

    await Promise.resolve()

    if (runSuiteError) {
      throw runSuiteError
    }
  })

  aroundAll(async (runSuite) => {
    await runSuite()
    throw new Error('inner aroundAll teardown failure')
  })

  test('a', () => {
    expect(1).toBe(1)
  })
})
`

test('aroundAll continues protocol when outer hook catches runSuite error', async () => {
  const { errorTree } = await runInlineTests({
    'basic.test.ts': aroundAllOuterCatchesInnerErrorSource,
  }, {
    maxConcurrency: 1,
  })

  expect(errorTree()).toMatchInlineSnapshot(`
    {
      "basic.test.ts": {
        "suite": {
          "__suite_errors__": [
            "inner aroundAll teardown failure",
          ],
          "a": "passed",
        },
      },
    }
  `)
})

const aroundEachCaughtInnerErrorTeardownTimeoutSource = `
import { aroundEach, describe, expect, test } from 'vitest'

describe.concurrent('wrapper', () => {
  aroundEach(async (runTest) => {
    try {
      await runTest()
    }
    catch {
      // swallow inner failure, then run long teardown logic
    }
    await new Promise(resolve => setTimeout(resolve, 200))
  }, 50)

  aroundEach(async (runTest) => {
    await runTest()
    throw new Error('inner aroundEach teardown failure')
  })

  test('a', () => {
    expect(1).toBe(1)
  })
})
`

test('aroundEach enforces teardown timeout when inner error is caught', async () => {
  const { errorTree } = await runInlineTests({
    'basic.test.ts': aroundEachCaughtInnerErrorTeardownTimeoutSource,
  }, {
    maxConcurrency: 1,
  })

  expect(errorTree()).toMatchInlineSnapshot(`
    {
      "basic.test.ts": {
        "wrapper": {
          "a": [
            "inner aroundEach teardown failure",
            "The teardown phase of "aroundEach" hook timed out after 50ms.",
          ],
        },
      },
    }
  `)
})

const aroundAllCaughtInnerErrorTeardownTimeoutSource = `
import { aroundAll, describe, expect, test } from 'vitest'

describe.concurrent('suite', () => {
  aroundAll(async (runSuite) => {
    try {
      await runSuite()
    }
    catch {
      // swallow inner failure, then run long teardown logic
    }
    await new Promise(resolve => setTimeout(resolve, 200))
  }, 50)

  aroundAll(async (runSuite) => {
    await runSuite()
    throw new Error('inner aroundAll teardown failure')
  })

  test('a', () => {
    expect(1).toBe(1)
  })
})
`

test('aroundAll enforces teardown timeout when inner error is caught', async () => {
  const { errorTree } = await runInlineTests({
    'basic.test.ts': aroundAllCaughtInnerErrorTeardownTimeoutSource,
  }, {
    maxConcurrency: 1,
  })

  expect(errorTree()).toMatchInlineSnapshot(`
    {
      "basic.test.ts": {
        "suite": {
          "__suite_errors__": [
            "inner aroundAll teardown failure",
            "The teardown phase of "aroundAll" hook timed out after 50ms.",
          ],
          "a": "passed",
        },
      },
    }
  `)
})
