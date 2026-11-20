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
  const { stderr, results } = await runInlineTests(orderFiles, { seed: 0 })
  expect(stderr).toBe('')
  const values = testMeta(results, 'values')
  expect(values).toMatchInlineSnapshot(`
    {
      "carts.test.js > creates an order": [
        "ab0409eb-10e6-4cc3-be34-5e3cc53d5830",
        0.7802182062789214,
      ],
      "orders.test.js > cancels an order": [
        "6c18cf6a-5b43-43a1-94ea-a018f31eb1b4",
        0.08474908933518832,
        0.4836801956339343,
        "3f5add2b-b847-474f-be97-cdc5192adc79",
      ],
      "orders.test.js > creates an order": [
        "6c18cf6a-5b43-43a1-94ea-a018f31eb1b4",
        0.08474908933518832,
        0.8471971846677014,
        "ce330d05-ce87-40ab-b07e-518787f5ce0a",
      ],
    }
  `)

  const filtered = await runInlineTests(orderFiles, { seed: 0, testNamePattern: 'cancels' })
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
  const { stderr, results } = await runInlineTests(tenantFiles, { seed: 0 })
  expect(stderr).toBe('')
  const values = testMeta(results, 'values')
  expect(values).toMatchInlineSnapshot(`
    {
      "tenants.test.js > carts > creates a cart": [
        "ac161d2b-759d-4a05-8fa9-e35de9853d99",
        "7096bf5b-c952-4f3f-93b5-d9652d54160d",
        "72b0b95c-e752-4921-99f7-8c3a633a15d9",
        "1a682f2b-7d9f-4fb8-b113-c97a868027d3",
        0.31164540124205053,
      ],
      "tenants.test.js > orders > creates an order": [
        "e6561416-3115-4bcd-bf2e-620e8f28d359",
        "d3f9b0c4-3936-4884-86c8-946ad18f2ab6",
        "72b0b95c-e752-4921-99f7-8c3a633a15d9",
        "1a682f2b-7d9f-4fb8-b113-c97a868027d3",
        0.6950767010639503,
      ],
    }
  `)

  const filtered = await runInlineTests(tenantFiles, { seed: 0, testNamePattern: 'cart' })
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

  const { stderr, stdout } = await runInlineTests(teardownFiles, { seed: 0 })
  expect(stderr).toBe('')
  const logs = getLogs(stdout)
  expect(logs).toMatchInlineSnapshot(`
    [
      ">> region 5dcb98f3-04ed-4e59-9a96-1c8a675cab99",
      ">> tenant 72b0b95c-e752-4921-99f7-8c3a633a15d9",
    ]
  `)

  const filtered = await runInlineTests(teardownFiles, { seed: 0, testNamePattern: 'tenant' })
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
    seed: 0,
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

  const second = await runInlineTests(diceFiles, {
    seed: 0,
    fakeRandom: { enableGlobally: true },
  })
  expect(testMeta(second.results, 'values')).toEqual(values)

  const filtered = await runInlineTests(diceFiles, {
    seed: 0,
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
  const plain = await runInlineTests(files, { seed: 0 })
  const traced = await runInlineTests(files, { seed: 0, experimental: { traceTimeline: true } })
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
      seed: 0,
      pool,
      setupFiles: ['./setup.js'],
    })
    expect.soft(stderr, pool).toBe('')
    values.push(testMeta(results, 'values'))
  }
  expect(values[0]).toMatchInlineSnapshot(`
    {
      "tokens.test.js > creates a token": [
        "99c5cda3-20f8-451b-9738-22df8625f29e",
        "fab3b8a5",
        706,
      ],
    }
  `)
  expect(values).toEqual([values[0], values[0], values[0], values[0]])
})

test('the fake replaces the random functions in jsdom and happy-dom', async () => {
  const files = {
    'ids.test.js': /* js */ `
      import { expect, test, vi } from 'vitest'

      test('creates ids', ({ task }) => {
        const real = [Math.random, crypto.randomUUID, crypto.getRandomValues]
        vi.useFakeRandom()
        task.meta.values = [
          Math.random(),
          crypto.randomUUID(),
          crypto.getRandomValues(new Uint8Array(4)).join(','),
        ]
        if (typeof window !== 'undefined') {
          task.meta.window = window.crypto.randomUUID()
        }
        vi.useRealRandom()
        const restored = [Math.random, crypto.randomUUID, crypto.getRandomValues]
        expect(restored.every((fn, index) => fn === real[index])).toBe(true)
      })
    `,
  }
  const runs: Record<string, { values: unknown; window: unknown }> = {}
  for (const environment of ['node', 'jsdom', 'happy-dom']) {
    const { stderr, results } = await runInlineTests(files, { seed: 0, environment })
    expect.soft(stderr, environment).toBe('')
    runs[environment] = {
      values: testMeta(results, 'values')['ids.test.js > creates ids'],
      window: testMeta(results, 'window')['ids.test.js > creates ids'],
    }
  }
  expect(runs).toMatchInlineSnapshot(`
    {
      "happy-dom": {
        "values": [
          0.21127190761548564,
          "f97aca20-07a9-4710-bcfb-af6abed22668",
          "122,19,136,250",
        ],
        "window": "49be8021-fb8a-4a4d-8e6f-177aa7ddb2c3",
      },
      "jsdom": {
        "values": [
          0.21127190761548564,
          "f97aca20-07a9-4710-bcfb-af6abed22668",
          "122,19,136,250",
        ],
        "window": "49be8021-fb8a-4a4d-8e6f-177aa7ddb2c3",
      },
      "node": {
        "values": [
          0.21127190761548564,
          "f97aca20-07a9-4710-bcfb-af6abed22668",
          "122,19,136,250",
        ],
        "window": undefined,
      },
    }
  `)
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
