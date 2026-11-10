import type { TestModule } from 'vitest/node'
import { expect, test } from 'vitest'
import { runInlineTests } from '#test-utils'

function testMeta(modules: TestModule[], key: string) {
  return Object.fromEntries(
    modules.flatMap((module) =>
      [...module.children.allTests()].map((testCase) => [
        `${module.moduleId.split('/').at(-1)} > ${testCase.fullName}`,
        testCase.meta()[key],
      ]),
    ),
  )
}

const orderFiles = {
  'orders.test.js': /* js */ `
    import { beforeAll, test, vi } from 'vitest'

    vi.useFakeRandom()
    const moduleId = crypto.randomUUID()
    let hookValue

    beforeAll(() => {
      hookValue = Math.random()
    })

    test('creates an order', ({ task }) => {
      task.meta.values = [moduleId, hookValue, Math.random(), crypto.randomUUID()]
    })

    test('cancels an order', ({ task }) => {
      task.meta.values = [moduleId, hookValue, Math.random(), crypto.randomUUID()]
    })
  `,
  'carts.test.js': /* js */ `
    import { test, vi } from 'vitest'

    vi.useFakeRandom()
    const moduleId = crypto.randomUUID()

    test('creates an order', ({ task }) => {
      task.meta.values = [moduleId, Math.random()]
    })
  `,
}

test('each test gets its own values, also with a filter', async () => {
  const { stderr, results } = await runInlineTests(orderFiles)
  expect(stderr).toBe('')
  const values = testMeta(results, 'values')
  expect(values).toMatchInlineSnapshot(`
    {
      "carts.test.js > creates an order": [
        "943f5719-f7c5-4802-8c4a-f123aa114253",
        0.12008342296327046,
      ],
      "orders.test.js > cancels an order": [
        "cb2a2edf-28af-4ccc-9e9d-8e34e0320d18",
        0.14195644243947547,
        0.38102384196966177,
        "591c5260-c4e5-4259-821c-ee1d3a9e7922",
      ],
      "orders.test.js > creates an order": [
        "cb2a2edf-28af-4ccc-9e9d-8e34e0320d18",
        0.14195644243947547,
        0.6512587903881975,
        "8271176f-991c-4cf3-bfef-db5c0f41e113",
      ],
    }
  `)

  const filtered = await runInlineTests(orderFiles, { testNamePattern: 'cancels' })
  expect(filtered.stderr).toBe('')
  expect(filtered.testTree()).toMatchInlineSnapshot(`
    {
      "carts.test.js": {
        "creates an order": "skipped",
      },
      "orders.test.js": {
        "cancels an order": "passed",
        "creates an order": "skipped",
      },
    }
  `)
  expect(testMeta(filtered.results, 'values')['orders.test.js > cancels an order']).toEqual(
    values['orders.test.js > cancels an order'],
  )
})

const tenantFiles = {
  'tenants.test.js': /* js */ `
    import { aroundAll, beforeAll, describe, test as base, vi } from 'vitest'

    vi.useFakeRandom()

    const test = base.extend({
      tenant: [async ({}, use) => { await use(crypto.randomUUID()) }, { scope: 'file' }],
      region: [async ({}, use) => { await use(crypto.randomUUID()) }, { scope: 'worker' }],
    })

    describe('orders', () => {
      let sessionId
      let orderId

      aroundAll(async (runSuite) => {
        sessionId = crypto.randomUUID()
        await runSuite()
      })

      beforeAll(() => {
        orderId = crypto.randomUUID()
      })

      test('creates an order', ({ task, tenant, region }) => {
        task.meta.values = [sessionId, orderId, tenant, region, Math.random()]
      })
    })

    describe('carts', () => {
      let sessionId
      let cartId

      aroundAll(async (runSuite) => {
        sessionId = crypto.randomUUID()
        await runSuite()
      })

      beforeAll(() => {
        cartId = crypto.randomUUID()
      })

      test('creates a cart', ({ task, tenant, region }) => {
        task.meta.values = [sessionId, cartId, tenant, region, Math.random()]
      })
    })
  `,
}

test('suite hooks and fixtures of file or worker scope keep their values with a filter', async () => {
  const { stderr, results } = await runInlineTests(tenantFiles)
  expect(stderr).toBe('')
  const values = testMeta(results, 'values')
  expect(values).toMatchInlineSnapshot(`
    {
      "tenants.test.js > carts > creates a cart": [
        "aecf327d-7fa8-4218-b426-35b7a9ef0d26",
        "daa0be01-7a64-4010-a649-cc31ec3c2073",
        "6a96029c-b3e5-4cac-b31e-f6533510e9a6",
        "590b7a96-a53e-4882-b34f-3b125c40c339",
        0.19330900795654138,
      ],
      "tenants.test.js > orders > creates an order": [
        "d908a49e-5fed-46a7-a7ab-b2c1ef334905",
        "705170ef-998c-4334-a9c6-65e4adc208d3",
        "6a96029c-b3e5-4cac-b31e-f6533510e9a6",
        "590b7a96-a53e-4882-b34f-3b125c40c339",
        0.23271932136277096,
      ],
    }
  `)

  const filtered = await runInlineTests(tenantFiles, { testNamePattern: 'cart' })
  expect(filtered.stderr).toBe('')
  expect(testMeta(filtered.results, 'values')['tenants.test.js > carts > creates a cart']).toEqual(
    values['tenants.test.js > carts > creates a cart'],
  )
})

const teardownFiles = {
  'tenants.test.js': /* js */ `
    import { test as base, vi } from 'vitest'

    vi.useFakeRandom()

    const test = base.extend({
      tenant: [
        async ({}, use) => {
          await use('tenant')
          // waits for the database to close
          await new Promise((resolve) => setTimeout(resolve, 10))
          console.log('>> tenant', crypto.randomUUID())
        },
        { scope: 'file' },
      ],
    })

    const regionTest = base.extend({
      region: [
        async ({}, use) => {
          await use('region')
          console.log('>> region', crypto.randomUUID())
        },
        { scope: 'file' },
      ],
    })

    test('creates a tenant', ({ tenant }) => {})
    regionTest('creates a region', ({ region }) => {})
  `,
}

test('file fixtures keep their teardown values with a filter', async () => {
  const getLogs = (stdout: string) => stdout.split('\n').filter((line) => line.startsWith('>> '))

  const { stderr, stdout } = await runInlineTests(teardownFiles)
  expect(stderr).toBe('')
  const logs = getLogs(stdout)
  expect(logs).toMatchInlineSnapshot(`
    [
      ">> region 018f172e-99bc-455f-87bf-381d3b119c0b",
      ">> tenant 6a96029c-b3e5-4cac-b31e-f6533510e9a6",
    ]
  `)

  const filtered = await runInlineTests(teardownFiles, { testNamePattern: 'tenant' })
  expect(filtered.stderr).toBe('')
  expect(getLogs(filtered.stdout)).toEqual([logs[1]])
})

test('each attempt starts again with the same values', async () => {
  const { stderr, results } = await runInlineTests({
    'retry.test.js': /* js */ `
      import { expect, test, vi } from 'vitest'

      vi.useFakeRandom()

      test('retries with the same values', { retry: 1 }, ({ task }) => {
        task.meta.values ??= []
        task.meta.values.push(Math.random())
        // fails on the first attempt
        expect(task.meta.values).toEqual([task.meta.values[0], task.meta.values[0]])
      })
    `,
  })
  expect(stderr).toBe('')
  const testCase = [...results[0].children.allTests()][0]
  expect(testCase.result().state).toBe('passed')

  // the attempt used the seed of `random` without reading `random`
  const seeds = testCase.attempts().map((attempt) => attempt.seed)
  expect(seeds).toHaveLength(2)
  expect(seeds[0]).toMatch(/^[\da-f]{16}$/)
  expect(seeds[1]).toBe(seeds[0])
})

test('restoreRandom restores the real functions before each test', async () => {
  const { stderr, testTree } = await runInlineTests(
    {
      'ids.test.js': /* js */ `
        import { beforeEach, describe, expect, test, vi } from 'vitest'

        const realRandom = Math.random
        vi.useFakeRandom()

        test('starts with the real functions', () => {
          expect(Math.random).toBe(realRandom)
          vi.useFakeRandom()
        })

        test('does not keep the fake of the previous test', () => {
          expect(Math.random).toBe(realRandom)
          expect(vi.isFakeRandom()).toBe(false)
        })

        describe('with a beforeEach hook', () => {
          beforeEach(() => {
            vi.useFakeRandom()
          })

          test('gets the fake of the hook', () => {
            expect(Math.random).not.toBe(realRandom)
          })
        })
      `,
    },
    { restoreRandom: true },
  )
  expect(stderr).toBe('')
  expect(testTree()).toMatchInlineSnapshot(`
    {
      "ids.test.js": {
        "does not keep the fake of the previous test": "passed",
        "starts with the real functions": "passed",
        "with a beforeEach hook": {
          "gets the fake of the hook": "passed",
        },
      },
    }
  `)
})

const diceFiles = {
  // keeps a reference when it loads, as lodash does
  'dice.js': /* js */ `
    const nativeRandom = Math.random
    export const roll = () => Math.floor(nativeRandom() * 6) + 1
  `,
  'dice.test.js': /* js */ `
    import { expect, test, vi } from 'vitest'
    import { roll } from './dice.js'

    test('rolls the dice', ({ task }) => {
      task.meta.values = [roll(), roll(), roll()]
      vi.useRealRandom()
    })

    test('rolls the dice again', ({ task }) => {
      expect(vi.isFakeRandom()).toBe(true)
      task.meta.values = [roll(), roll(), roll()]
    })
  `,
}

test('fakeRandom.enableGlobally replaces the functions before the test file loads', async () => {
  const { stderr, testTree, results } = await runInlineTests(diceFiles, {
    fakeRandom: { enableGlobally: true },
  })
  expect(stderr).toBe('')
  expect(testTree()).toMatchInlineSnapshot(`
    {
      "dice.test.js": {
        "rolls the dice": "passed",
        "rolls the dice again": "passed",
      },
    }
  `)
  const values = testMeta(results, 'values')

  const second = await runInlineTests(diceFiles, { fakeRandom: { enableGlobally: true } })
  expect(testMeta(second.results, 'values')).toEqual(values)

  const filtered = await runInlineTests(diceFiles, {
    fakeRandom: { enableGlobally: true },
    testNamePattern: 'again',
  })
  expect(testMeta(filtered.results, 'values')['dice.test.js > rolls the dice again']).toEqual(
    values['dice.test.js > rolls the dice again'],
  )
})

test('fakeRandom.enableGlobally and restoreRandom cannot be used together', async () => {
  const { stderr } = await runInlineTests(diceFiles, {
    fakeRandom: { enableGlobally: true },
    restoreRandom: true,
  })
  expect(stderr.split('\n')[0]).toMatchInlineSnapshot(
    `"Error: \`fakeRandom.enableGlobally\` and \`restoreRandom\` cannot be used together."`,
  )
})

test('the fake throws in concurrent tests and suites', async () => {
  const { errorTree } = await runInlineTests(
    {
      'checkout.test.js': /* js */ `
        import { beforeAll, describe, test } from 'vitest'

        test.concurrent('creates an order id', () => {
          crypto.randomUUID()
        })

        test.concurrent('sends the order', () => {})

        describe.concurrent('payments', () => {
          let paymentId

          beforeAll(() => {
            paymentId = Math.random()
          })

          test('charges the card', () => {})
        })

        test('creates a cart id', () => {
          crypto.randomUUID()
        })
      `,
    },
    { fakeRandom: { enableGlobally: true } },
  )
  expect(errorTree()).toMatchInlineSnapshot(`
    {
      "checkout.test.js": {
        "creates a cart id": "passed",
        "creates an order id": [
          "The fake random functions cannot be used in concurrent tests and suites, because their values would depend on the order of the calls. Use \`context.random\` or \`vi.createRandom()\` instead.",
        ],
        "payments": {
          "__suite_errors__": [
            "The fake random functions cannot be used in concurrent tests and suites, because their values would depend on the order of the calls. Use \`context.random\` or \`vi.createRandom()\` instead.",
          ],
          "charges the card": "skipped",
        },
        "sends the order": "passed",
      },
    }
  `)
})

test('the fake throws in hooks that run at the same time', async () => {
  const { errorTree } = await runInlineTests(
    {
      'checkout.test.js': /* js */ `
        import { beforeEach, describe, test, vi } from 'vitest'

        vi.useFakeRandom()

        describe('orders', () => {
          const orders = []

          beforeEach(() => {
            orders.length = 0
          })

          beforeEach(() => {
            orders.push({ id: crypto.randomUUID() })
          })

          test('creates an order', () => {})
        })

        describe('carts', () => {
          let cartId

          beforeEach(() => {
            cartId = crypto.randomUUID()
          })

          test('creates a cart', () => {
            Math.random()
          })
        })
      `,
    },
    { sequence: { hooks: 'parallel' } },
  )
  expect(errorTree()).toMatchInlineSnapshot(`
    {
      "checkout.test.js": {
        "carts": {
          "creates a cart": "passed",
        },
        "orders": {
          "creates an order": [
            "The fake random functions cannot be used in hooks that run at the same time (\`sequence.hooks: 'parallel'\`), because their values would depend on the order of the calls. Use \`context.random\` or \`vi.createRandom()\` instead.",
          ],
        },
      },
    }
  `)
})

test('the trace timeline does not take values from the fake', async () => {
  const files = {
    'wait.test.js': /* js */ `
      import { test, vi } from 'vitest'

      test('waits for the order', async ({ task }) => {
        vi.useFakeRandom()
        await vi.waitFor(() => true)
        task.meta.value = Math.random()
      })
    `,
  }
  const plain = await runInlineTests(files)
  const traced = await runInlineTests(files, { experimental: { traceTimeline: true } })
  expect(plain.stderr).toBe('')
  expect(traced.stderr).toBe('')
  expect(testMeta(traced.results, 'value')).toEqual(testMeta(plain.results, 'value'))
})

test('node:crypto returns the same values in every pool', async () => {
  const files = {
    'tokens.test.js': /* js */ `
      import { randomBytes, randomInt, randomUUID } from 'node:crypto'
      import { test } from 'vitest'

      test('creates a token', ({ task }) => {
        task.meta.values = [randomUUID(), randomBytes(4).toString('hex'), randomInt(1000)]
      })
    `,
    'setup.js': /* js */ `
      import { vi } from 'vitest'

      vi.useFakeRandom()
    `,
  }
  const values: Record<string, unknown>[] = []
  for (const pool of ['threads', 'forks', 'vmThreads', 'vmForks'] as const) {
    const { stderr, results } = await runInlineTests(files, {
      pool,
      setupFiles: ['./setup.js'],
    })
    expect.soft(stderr, pool).toBe('')
    values.push(testMeta(results, 'values'))
  }
  expect(values[0]).toMatchInlineSnapshot(`
    {
      "tokens.test.js > creates a token": [
        "b6b1924c-99ff-49cf-8fb0-f5d87b72a8c1",
        "3b490bd8",
        186,
      ],
    }
  `)
  expect(values).toEqual([values[0], values[0], values[0], values[0]])
})

test('the vm pools restore crypto after each file', async () => {
  // the files share the crypto object of the worker
  const file = /* js */ `
    import { expect, test, vi } from 'vitest'

    test('starts with the real functions', () => {
      expect(Object.hasOwn(crypto, 'randomUUID')).toBe(false)
      vi.useFakeRandom()
    })
  `
  const { stderr, testTree } = await runInlineTests(
    { 'first.test.js': file, 'second.test.js': file },
    { pool: 'vmThreads' },
  )
  expect(stderr).toBe('')
  expect(testTree()).toMatchInlineSnapshot(`
    {
      "first.test.js": {
        "starts with the real functions": "passed",
      },
      "second.test.js": {
        "starts with the real functions": "passed",
      },
    }
  `)
})
