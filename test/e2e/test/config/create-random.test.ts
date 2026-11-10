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
      ":creates an order": 458,
      ":lists the products": 458,
    }
  `)

  const sharedRun = await runInlineTests(shopFiles, {
    setupFiles: ['./setup.js'],
    isolate: false,
  })
  expect(sharedRun.stderr).toBe('')
  expect(testMeta(sharedRun.results, 'price')).toEqual(testMeta(results, 'price'))
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

  const fixedRun = await runInlineTests(files, { globalSetup: ['./global-setup.js'] })
  expect(fixedRun.stderr).toBe('')
  expect(fixedRun.testTree()).toMatchInlineSnapshot(`
    {
      "admin.test.js": {
        "signs in as the admin": "passed",
      },
    }
  `)

  const shuffledRun = await runInlineTests(files, {
    globalSetup: ['./global-setup.js'],
    sequence: { shuffle: true },
  })
  expect(shuffledRun.stderr).toBe('')
  expect(shuffledRun.ctx?.getSeed()).toEqual(expect.any(Number))
  expect(shuffledRun.testTree()).toEqual(fixedRun.testTree())
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
