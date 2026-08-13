import { expect, test } from 'vitest'
import { runInlineTests } from '../../test-utils'

function extractLogs(stdout: string): string {
  return stdout.split('\n').filter(l => l.includes('>>')).join('\n')
}

test('AsyncLocalStorage context set in a fixture is visible in the test body', async () => {
  const { stdout, stderr } = await runInlineTests({
    'als-fixture.test.ts': `
      import { AsyncLocalStorage } from 'node:async_hooks'
      import { expect, test as base } from 'vitest'

      const als = new AsyncLocalStorage()

      const test = base.extend({
        store: [
          async ({}, use) => {
            const store = { app: 'alpha' }
            await als.run(store, () => use(store))
          },
          { auto: true },
        ],
      })

      test('reads the store without a visible wrapper', ({ store }) => {
        console.log('>> store: ' + als.getStore()?.app)
        console.log('>> fixture value: ' + store.app)
        expect(als.getStore()).toBe(store)
      })
    `,
  })

  expect(stderr).toBe('')
  expect(extractLogs(stdout)).toMatchInlineSnapshot(`
    ">> store: alpha
    >> fixture value: alpha"
  `)
})

test('fixture store is visible in beforeEach and afterEach hooks', async () => {
  const { stdout, stderr } = await runInlineTests({
    'hooks.test.ts': `
      import { AsyncLocalStorage } from 'node:async_hooks'
      import { afterEach, beforeEach, test as base } from 'vitest'

      const als = new AsyncLocalStorage()

      const test = base.extend({
        store: [
          async ({}, use) => als.run({ app: 'alpha' }, () => use('store')),
          { auto: true },
        ],
      })

      beforeEach(() => {
        console.log('>> beforeEach: ' + als.getStore()?.app)
      })

      afterEach(() => {
        console.log('>> afterEach: ' + als.getStore()?.app)
      })

      test('test 1', () => {
        console.log('>> test: ' + als.getStore()?.app)
      })
    `,
  })

  expect(stderr).toBe('')
  expect(extractLogs(stdout)).toMatchInlineSnapshot(`
    ">> beforeEach: alpha
    >> test: alpha
    >> afterEach: alpha"
  `)
})

test('non-auto fixture store becomes visible only after the fixture resolves', async () => {
  const { stdout, stderr } = await runInlineTests({
    'lazy.test.ts': `
      import { AsyncLocalStorage } from 'node:async_hooks'
      import { afterEach, beforeEach, test as base } from 'vitest'

      const als = new AsyncLocalStorage()

      const test = base.extend({
        store: async ({}, use) => als.run({ app: 'alpha' }, () => use('store')),
      })

      beforeEach(() => {
        console.log('>> beforeEach: ' + als.getStore()?.app)
      })

      afterEach(() => {
        console.log('>> afterEach: ' + als.getStore()?.app)
      })

      test('test 1', ({ store }) => {
        console.log('>> test: ' + als.getStore()?.app)
      })
    `,
  })

  expect(stderr).toBe('')
  expect(extractLogs(stdout)).toMatchInlineSnapshot(`
    ">> beforeEach: undefined
    >> test: alpha
    >> afterEach: alpha"
  `)
})

test('a beforeEach that uses the fixture makes the store visible to later hooks and the test', async () => {
  const { stdout, stderr } = await runInlineTests({
    'hook-trigger.test.ts': `
      import { AsyncLocalStorage } from 'node:async_hooks'
      import { beforeEach, test as base } from 'vitest'

      const als = new AsyncLocalStorage()

      const test = base.extend({
        store: async ({}, use) => als.run({ app: 'alpha' }, () => use('store')),
      })

      beforeEach(({ store }) => {
        console.log('>> first beforeEach: ' + als.getStore()?.app)
      })

      beforeEach(() => {
        console.log('>> second beforeEach: ' + als.getStore()?.app)
      })

      test('test 1', () => {
        console.log('>> test: ' + als.getStore()?.app)
      })
    `,
  })

  expect(stderr).toBe('')
  expect(extractLogs(stdout)).toMatchInlineSnapshot(`
    ">> first beforeEach: alpha
    >> second beforeEach: alpha
    >> test: alpha"
  `)
})

test('a dependent fixture runs inside the store of its dependency regardless of registration order', async () => {
  const { stdout, stderr } = await runInlineTests({
    'chained.test.ts': `
      import { AsyncLocalStorage } from 'node:async_hooks'
      import { test as base } from 'vitest'

      const als = new AsyncLocalStorage()

      const test = base.extend({
        service: async ({ store }, use) => {
          console.log('>> service setup sees: ' + als.getStore()?.app)
          await use('service')
        },
        store: async ({}, use) => als.run({ app: 'alpha' }, () => use('store')),
      })

      test('test 1', ({ service }) => {
        console.log('>> test: ' + als.getStore()?.app)
      })
    `,
  })

  expect(stderr).toBe('')
  expect(extractLogs(stdout)).toMatchInlineSnapshot(`
    ">> service setup sees: alpha
    >> test: alpha"
  `)
})

test('independent fixtures chain their stores in registration order', async () => {
  const { stdout, stderr } = await runInlineTests({
    'independent.test.ts': `
      import { AsyncLocalStorage } from 'node:async_hooks'
      import { test as base } from 'vitest'

      const als1 = new AsyncLocalStorage()
      const als2 = new AsyncLocalStorage()

      const test = base.extend({
        first: async ({}, use) => {
          console.log('>> first setup sees: ' + als2.getStore())
          await als1.run('one', () => use('first'))
        },
        second: async ({}, use) => {
          console.log('>> second setup sees: ' + als1.getStore())
          await als2.run('two', () => use('second'))
        },
      })

      test('test 1', ({ second, first }) => {
        console.log('>> test: ' + als1.getStore() + ' ' + als2.getStore())
      })
    `,
  })

  expect(stderr).toBe('')
  expect(extractLogs(stdout)).toMatchInlineSnapshot(`
    ">> first setup sees: undefined
    >> second setup sees: one
    >> test: one two"
  `)
})

test('aroundEach store and fixture store are both visible', async () => {
  const { stdout, stderr } = await runInlineTests({
    'around-interplay.test.ts': `
      import { AsyncLocalStorage } from 'node:async_hooks'
      import { aroundEach, test as base } from 'vitest'

      const alsFixture = new AsyncLocalStorage()
      const alsAround = new AsyncLocalStorage()

      const test = base.extend({
        db: async ({}, use) => alsFixture.run('from-fixture', () => use('db')),
      })

      aroundEach(async (runTest, { db }) => {
        console.log('>> around sees fixture store: ' + alsFixture.getStore())
        await alsAround.run('from-around', runTest)
      })

      test('test 1', ({ db }) => {
        console.log('>> test fixture store: ' + alsFixture.getStore())
        console.log('>> test around store: ' + alsAround.getStore())
      })
    `,
  })

  expect(stderr).toBe('')
  expect(extractLogs(stdout)).toMatchInlineSnapshot(`
    ">> around sees fixture store: from-fixture
    >> test fixture store: from-fixture
    >> test around store: from-around"
  `)
})

test('concurrent tests keep isolated fixture stores', async () => {
  const { stdout, stderr } = await runInlineTests({
    'concurrent.test.ts': `
      import { AsyncLocalStorage } from 'node:async_hooks'
      import { expect, test as base } from 'vitest'

      const als = new AsyncLocalStorage()
      const sleep = (ms) => new Promise(r => setTimeout(r, ms))

      const test = base.extend({
        id: async ({ task }, use) => als.run({ id: task.name }, () => use(task.name)),
      })

      test.concurrent('first', async ({ id }) => {
        await sleep(30)
        expect(als.getStore()?.id).toBe('first')
      })

      test.concurrent('second', async ({ id }) => {
        await sleep(10)
        expect(als.getStore()?.id).toBe('second')
      })
    `,
  })

  expect(stderr).toBe('')
  const testsLine = stdout.split('\n').find(l => /^\s*Tests\s/.test(l))?.trim()
  expect(testsLine).toMatchInlineSnapshot(`"Tests  2 passed (2)"`)
})

test('each retry attempt gets a fresh fixture store', async () => {
  const { stdout, stderr } = await runInlineTests({
    'retry.test.ts': `
      import { AsyncLocalStorage } from 'node:async_hooks'
      import { expect, test as base } from 'vitest'

      const als = new AsyncLocalStorage()
      let attempt = 0

      const test = base.extend({
        store: async ({}, use) => {
          attempt++
          await als.run({ attempt }, () => use(attempt))
        },
      })

      test('flaky', { retry: 1 }, ({ store }) => {
        console.log('>> attempt ' + als.getStore()?.attempt)
        expect(als.getStore()?.attempt).toBe(2)
      })
    `,
  })

  expect(stderr).toBe('')
  expect(extractLogs(stdout)).toMatchInlineSnapshot(`
    ">> attempt 1
    >> attempt 2"
  `)
})

// A snapshot replaces the whole async context frame when entered, so a chain
// captured in a file/worker-scoped fixture would leak the resolving test's
// ambient context into other tests and erase later suite-level contexts.
// Scoped fixtures therefore deliberately do not propagate their store — only
// their value. Use aroundEach/aroundAll to establish a store for many tests.
test('file-scoped fixture values propagate but their store does not', async () => {
  const { stdout, stderr } = await runInlineTests({
    'file-scope.test.ts': `
      import { AsyncLocalStorage } from 'node:async_hooks'
      import { test as base } from 'vitest'

      const als = new AsyncLocalStorage()

      const test = base.extend({
        shared: [
          async ({}, use) => {
            console.log('>> file fixture setup')
            await als.run({ id: 'shared' }, () => use('shared-value'))
          },
          { scope: 'file' },
        ],
      })

      test('first', ({ shared }) => {
        console.log('>> first: ' + shared + ' / store: ' + als.getStore()?.id)
      })

      test('second', ({ shared }) => {
        console.log('>> second: ' + shared + ' / store: ' + als.getStore()?.id)
      })
    `,
  })

  expect(stderr).toBe('')
  expect(extractLogs(stdout)).toMatchInlineSnapshot(`
    ">> file fixture setup
    >> first: shared-value / store: undefined
    >> second: shared-value / store: undefined"
  `)
})

test('aroundAll store stays visible when file-scoped fixtures are used', async () => {
  const { stdout, stderr } = await runInlineTests({
    'around-all.test.ts': `
      import { AsyncLocalStorage } from 'node:async_hooks'
      import { aroundAll, describe, test as base } from 'vitest'

      const alsSuite = new AsyncLocalStorage()

      const test = base.extend({
        shared: [async ({}, use) => use('shared-value'), { scope: 'file' }],
      })

      test('outside', ({ shared }) => {
        console.log('>> outside: ' + alsSuite.getStore())
      })

      describe('wrapped suite', () => {
        aroundAll(async (runSuite) => {
          await alsSuite.run('from-around-all', runSuite)
        })

        test('inside with fixture', ({ shared }) => {
          console.log('>> inside: ' + alsSuite.getStore())
        })

        test('inside without fixture', () => {
          console.log('>> inside plain: ' + alsSuite.getStore())
        })
      })
    `,
  })

  expect(stderr).toBe('')
  expect(extractLogs(stdout)).toMatchInlineSnapshot(`
    ">> outside: undefined
    >> inside: from-around-all
    >> inside plain: from-around-all"
  `)
})

test('aroundAll store does not leak past its suite via a file-scoped fixture', async () => {
  const { stdout, stderr } = await runInlineTests({
    'around-all-leak.test.ts': `
      import { AsyncLocalStorage } from 'node:async_hooks'
      import { aroundAll, describe, test as base } from 'vitest'

      const alsSuite = new AsyncLocalStorage()

      const test = base.extend({
        shared: [
          async ({}, use) => {
            console.log('>> fixture resolves in: ' + alsSuite.getStore())
            await use('shared-value')
          },
          { scope: 'file' },
        ],
      })

      describe('wrapped suite', () => {
        aroundAll(async (runSuite) => {
          await alsSuite.run('from-around-all', runSuite)
        })

        test('inside', ({ shared }) => {
          console.log('>> inside: ' + alsSuite.getStore())
        })
      })

      test('after', ({ shared }) => {
        console.log('>> after: ' + alsSuite.getStore())
      })
    `,
  })

  expect(stderr).toBe('')
  expect(extractLogs(stdout)).toMatchInlineSnapshot(`
    ">> fixture resolves in: from-around-all
    >> inside: from-around-all
    >> after: undefined"
  `)
})

test('beforeEach-returned cleanup sees the fixture store', async () => {
  const { stdout, stderr } = await runInlineTests({
    'cleanup.test.ts': `
      import { AsyncLocalStorage } from 'node:async_hooks'
      import { beforeEach, test as base } from 'vitest'

      const als = new AsyncLocalStorage()

      const test = base.extend({
        store: [
          async ({}, use) => als.run({ app: 'alpha' }, () => use('store')),
          { auto: true },
        ],
      })

      beforeEach(() => {
        return () => {
          console.log('>> cleanup: ' + als.getStore()?.app)
        }
      })

      test('test 1', () => {
        console.log('>> test: ' + als.getStore()?.app)
      })
    `,
  })

  expect(stderr).toBe('')
  expect(extractLogs(stdout)).toMatchInlineSnapshot(`
    ">> test: alpha
    >> cleanup: alpha"
  `)
})

test('request-context pattern: auto fixture with per-suite override', async () => {
  const { stdout, stderr } = await runInlineTests({
    'request-context.test.ts': `
      import { AsyncLocalStorage } from 'node:async_hooks'
      import { describe, expect, test as base } from 'vitest'

      const contextStorage = new AsyncLocalStorage()
      const getContext = () => {
        const ctx = contextStorage.getStore()
        if (!ctx) throw new Error('Context not found')
        return ctx
      }

      const test = base
        .extend({ app: 'alpha' })
        .extend({
          ctx: [
            async ({ app }, use) => {
              const ctx = { app, logs: [] }
              await contextStorage.run(ctx, () => use(ctx))
            },
            { auto: true },
          ],
        })

      test('uses the default app', ({ ctx }) => {
        console.log('>> default: ' + getContext().app)
        expect(getContext()).toBe(ctx)
      })

      describe('on beta', () => {
        test.override({ app: 'beta' })

        test('uses the overridden app', () => {
          console.log('>> override: ' + getContext().app)
        })
      })
    `,
  })

  expect(stderr).toBe('')
  expect(extractLogs(stdout)).toMatchInlineSnapshot(`
    ">> default: alpha
    >> override: beta"
  `)
})

test('onTestFinished sees the fixture store', async () => {
  const { stdout, stderr } = await runInlineTests({
    'finished.test.ts': `
      import { AsyncLocalStorage } from 'node:async_hooks'
      import { onTestFinished, test as base } from 'vitest'

      const als = new AsyncLocalStorage()

      const test = base.extend({
        store: [
          async ({}, use) => als.run({ app: 'alpha' }, () => use('store')),
          { auto: true },
        ],
      })

      test('test 1', () => {
        onTestFinished(() => {
          console.log('>> finished: ' + als.getStore()?.app)
        })
        console.log('>> test: ' + als.getStore()?.app)
      })
    `,
  })

  expect(stderr).toBe('')
  expect(extractLogs(stdout)).toMatchInlineSnapshot(`
    ">> test: alpha
    >> finished: alpha"
  `)
})

test('onTestFailed sees the fixture store', async () => {
  const { stdout, errorTree } = await runInlineTests({
    'failed.test.ts': `
      import { AsyncLocalStorage } from 'node:async_hooks'
      import { expect, onTestFailed, test as base } from 'vitest'

      const als = new AsyncLocalStorage()

      const test = base.extend({
        store: [
          async ({}, use) => als.run({ app: 'alpha' }, () => use('store')),
          { auto: true },
        ],
      })

      test('test 1', () => {
        onTestFailed(() => {
          console.log('>> failed: ' + als.getStore()?.app)
        })
        expect(1).toBe(2)
      })
    `,
  })

  expect(extractLogs(stdout)).toMatchInlineSnapshot(`">> failed: alpha"`)
  expect(errorTree()).toMatchInlineSnapshot(`
    {
      "failed.test.ts": {
        "test 1": [
          "expected 1 to be 2 // Object.is equality",
        ],
      },
    }
  `)
})

test('static and injected fixtures mixed with a store fixture keep the chain', async () => {
  const { stdout, stderr } = await runInlineTests({
    'mixed.test.ts': `
      import { AsyncLocalStorage } from 'node:async_hooks'
      import { test as base } from 'vitest'

      const als = new AsyncLocalStorage()

      const test = base.extend({
        store: async ({}, use) => als.run({ app: 'alpha' }, () => use('store')),
        staticValue: 42,
      })

      test('test 1', ({ store, staticValue }) => {
        console.log('>> store: ' + als.getStore()?.app + ' / static: ' + staticValue)
      })
    `,
  })

  expect(stderr).toBe('')
  expect(extractLogs(stdout)).toMatchInlineSnapshot(`
    ">> store: alpha / static: 42"
  `)
})

test('stacked aroundEach stores and a fixture store all accumulate', async () => {
  const { stdout, stderr } = await runInlineTests({
    'stacked.test.ts': `
      import { AsyncLocalStorage } from 'node:async_hooks'
      import { aroundEach, test as base } from 'vitest'

      const als1 = new AsyncLocalStorage()
      const als2 = new AsyncLocalStorage()
      const alsF = new AsyncLocalStorage()

      const test = base.extend({
        store: [async ({}, use) => alsF.run('F', () => use('store')), { auto: true }],
      })

      aroundEach(async (runTest) => als1.run('A1', runTest))
      aroundEach(async (runTest) => als2.run('A2', runTest))

      test('test 1', () => {
        console.log('>> ' + als1.getStore() + ' ' + als2.getStore() + ' ' + alsF.getStore())
      })
    `,
  })

  expect(stderr).toBe('')
  expect(extractLogs(stdout)).toMatchInlineSnapshot(`
    ">> A1 A2 F"
  `)
})

test('use() called outside als.run does not leak a store', async () => {
  const { stdout, stderr } = await runInlineTests({
    'no-leak.test.ts': `
      import { AsyncLocalStorage } from 'node:async_hooks'
      import { expect, test as base } from 'vitest'

      const als = new AsyncLocalStorage()

      const test = base.extend({
        store: async ({}, use) => {
          als.run({ app: 'X' }, () => {})
          await use('outside')
        },
      })

      test('test 1', ({ store }) => {
        console.log('>> store: ' + als.getStore())
        expect(als.getStore()).toBeUndefined()
      })
    `,
  })

  expect(stderr).toBe('')
  expect(extractLogs(stdout)).toMatchInlineSnapshot(`
    ">> store: undefined"
  `)
})

test('detectAsyncLeaks does not report the context snapshots', async () => {
  const { stdout, stderr } = await runInlineTests({
    'vitest.config.ts': `
      export default { test: { detectAsyncLeaks: true } }
    `,
    'leaks.test.ts': `
      import { AsyncLocalStorage } from 'node:async_hooks'
      import { test as base } from 'vitest'

      const als = new AsyncLocalStorage()

      const test = base.extend({
        a: async ({}, use) => als.run({ id: 'a' }, () => use('a')),
        b: async ({ a }, use) => use('b'),
      })

      test('test 1', ({ a, b }) => {
        console.log('>> store: ' + als.getStore()?.id)
      })
    `,
  })

  expect(stderr).toBe('')
  expect(stdout).not.toMatch(/leaking|Leaks\s+\d/)
  expect(extractLogs(stdout)).toMatchInlineSnapshot(`
    ">> store: a"
  `)
})

test('fixture teardown resumes inside the store the fixture opened', async () => {
  const { stdout, stderr } = await runInlineTests({
    'teardown.test.ts': `
      import { AsyncLocalStorage } from 'node:async_hooks'
      import { test as base } from 'vitest'

      const als = new AsyncLocalStorage()

      const test = base.extend({
        store: async ({}, use) => {
          await als.run({ app: 'alpha' }, async () => {
            console.log('>> setup: ' + als.getStore()?.app)
            await use('store')
            console.log('>> teardown: ' + als.getStore()?.app)
          })
        },
      })

      test('test 1', ({ store }) => {
        console.log('>> test: ' + als.getStore()?.app)
      })
    `,
  })

  expect(stderr).toBe('')
  expect(extractLogs(stdout)).toMatchInlineSnapshot(`
    ">> setup: alpha
    >> test: alpha
    >> teardown: alpha"
  `)
})
