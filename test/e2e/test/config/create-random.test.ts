import type { TestModule } from 'vitest/node'
import { expect, test } from 'vitest'
import { runInlineTests } from '#test-utils'

function testMeta(modules: TestModule[], key: string) {
  return Object.fromEntries(
    modules.flatMap((module) =>
      [...module.children.allTests()].map((testCase) => [
        `${module.project.name}:${testCase.fullName}`,
        testCase.meta()[key],
      ]),
    ),
  )
}

const shopFiles = {
  'setup.js': /* js */ `
    import { vi } from 'vitest'

    globalThis.setupPrice = vi.createRandom('prices').int(1, 500)
  `,
  'products.test.js': /* js */ `
    import { beforeAll, expect, test, vi } from 'vitest'

    const modulePrice = vi.createRandom('prices').int(1, 500)
    let hookPrice

    beforeAll(() => {
      hookPrice = vi.createRandom('prices').int(1, 500)
    })

    test('lists the products', ({ task }) => {
      expect(modulePrice).toBe(globalThis.setupPrice)
      expect(hookPrice).toBe(modulePrice)
      expect(vi.createRandom('discounts').seed).not.toBe(vi.createRandom('prices').seed)
      task.meta.price = modulePrice
    })
  `,
  'orders.test.js': /* js */ `
    import { test, vi } from 'vitest'

    test('creates an order', ({ task }) => {
      task.meta.price = vi.createRandom('prices').int(1, 500)
    })
  `,
}

test('equal labels return equal values in setup files, hooks and all test files', async () => {
  const { stderr, results, testTree } = await runInlineTests(shopFiles, {
    seed: 0,
    setupFiles: ['./setup.js'],
  })
  expect(stderr).toBe('')
  expect(testTree()).toMatchInlineSnapshot(`
    {
      "orders.test.js": {
        "creates an order": "passed",
      },
      "products.test.js": {
        "lists the products": "passed",
      },
    }
  `)
  expect(testMeta(results, 'price')).toMatchInlineSnapshot(`
    {
      ":creates an order": 489,
      ":lists the products": 489,
    }
  `)

  const sharedRun = await runInlineTests(shopFiles, {
    seed: 0,
    setupFiles: ['./setup.js'],
    isolate: false,
  })
  expect(sharedRun.stderr).toBe('')
  expect(testMeta(sharedRun.results, 'price')).toEqual(testMeta(results, 'price'))
})

const checkoutFiles = {
  'checkout.test.js': /* js */ `
    import { test, vi } from 'vitest'

    let runs = 0

    function record(task) {
      task.meta.price = vi.createRandom('prices').int(1, 500)
      task.meta.customer = vi.createRandom('customers', task.name).int(1, 10_000)
      task.meta.order = ++runs
    }

    test('adds a product', ({ task }) => record(task))
    test('applies a coupon', ({ task }) => record(task))
    test('pays the order', ({ task }) => record(task))
    test('sends the receipt', ({ task }) => record(task))
  `,
  'refunds.test.js': /* js */ `
    import { test, vi } from 'vitest'

    test('refunds the order', ({ task }) => {
      task.meta.price = vi.createRandom('prices').int(1, 500)
      task.meta.customer = vi.createRandom('customers', task.name).int(1, 10_000)
    })
  `,
}

// the price and the customer of each test that ran
function randomValues(modules: TestModule[]) {
  const prices = testMeta(modules, 'price')
  const customers = testMeta(modules, 'customer')
  return Object.fromEntries(
    Object.keys(prices)
      .filter((name) => prices[name] !== undefined)
      .map((name) => [name, `price ${prices[name]}, customer ${customers[name]}`]),
  )
}

test('filters and a shuffled order do not change the values', async () => {
  const full = await runInlineTests(checkoutFiles, { seed: 0 })
  const byFile = await runInlineTests(checkoutFiles, { seed: 0, $cliFilters: ['refunds'] })
  const byName = await runInlineTests(checkoutFiles, { seed: 0, testNamePattern: 'pays' })
  const shuffled = await runInlineTests(checkoutFiles, { seed: 0, sequence: { shuffle: true } })
  for (const run of [full, byFile, byName, shuffled]) {
    expect(run.stderr).toBe('')
  }

  const values = randomValues(full.results)
  expect(values).toMatchInlineSnapshot(`
    {
      ":adds a product": "price 489, customer 7476",
      ":applies a coupon": "price 489, customer 6482",
      ":pays the order": "price 489, customer 5214",
      ":refunds the order": "price 489, customer 7677",
      ":sends the receipt": "price 489, customer 10000",
    }
  `)
  expect(randomValues(byFile.results)).toEqual({
    ':refunds the order': values[':refunds the order'],
  })
  expect(randomValues(byName.results)).toEqual({ ':pays the order': values[':pays the order'] })
  expect(randomValues(shuffled.results)).toEqual(values)
  expect(testMeta(shuffled.results, 'order')).toMatchInlineSnapshot(`
    {
      ":adds a product": 3,
      ":applies a coupon": 1,
      ":pays the order": 2,
      ":refunds the order": undefined,
      ":sends the receipt": 4,
    }
  `)
})

test('the run seed and the project name change the values', async () => {
  const files = {
    'prices.test.js': /* js */ `
      import { test, vi } from 'vitest'

      test('records the price seed', ({ task }) => {
        task.meta.seed = vi.createRandom('prices').seed
      })
    `,
  }
  const defaultRun = await runInlineTests(files)
  const seededRun = await runInlineTests(files, { seed: 42 })
  const projectsRun = await runInlineTests(files, {
    projects: [{ test: { name: 'node' } }, { test: { name: 'edge' } }],
  })
  expect(defaultRun.stderr).toBe('')
  expect(seededRun.stderr).toBe('')
  expect(projectsRun.stderr).toBe('')

  const seeds = new Set(
    [defaultRun, seededRun, projectsRun].flatMap((run) =>
      Object.values(testMeta(run.results, 'seed')),
    ),
  )
  expect(seeds.size).toBe(4)
})

test('project.createRandom in the global setup returns the values of vi.createRandom', async () => {
  const files = {
    'global-setup.js': /* js */ `
      export default function setup({ provide, createRandom }) {
        provide('adminSeed', createRandom('admin').seed)
      }
    `,
    'admin.test.js': /* js */ `
      import { expect, inject, test, vi } from 'vitest'

      test('signs in as the admin', () => {
        expect(vi.createRandom('admin').seed).toBe(inject('adminSeed'))
      })
    `,
  }

  const { stderr, testTree } = await runInlineTests(files, { globalSetup: ['./global-setup.js'] })
  expect(stderr).toBe('')
  expect(testTree()).toMatchInlineSnapshot(`
    {
      "admin.test.js": {
        "signs in as the admin": "passed",
      },
    }
  `)
})

test('createRandom rejects labels that are not strings', async () => {
  const { errorTree } = await runInlineTests({
    'labels.test.js': /* js */ `
      import { test, vi } from 'vitest'

      test('uses a number as the label', () => {
        vi.createRandom(42)
      })
    `,
  })
  expect(errorTree()).toMatchInlineSnapshot(`
    {
      "labels.test.js": {
        "uses a number as the label": [
          "createRandom() expects string labels, received number.",
        ],
      },
    }
  `)
})
