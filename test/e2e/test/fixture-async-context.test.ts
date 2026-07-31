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

test('a dependent fixture runs inside the store of its dependency', async () => {
  const { stdout, stderr } = await runInlineTests({
    'chained.test.ts': `
      import { AsyncLocalStorage } from 'node:async_hooks'
      import { test as base } from 'vitest'

      const als = new AsyncLocalStorage()

      const test = base.extend({
        store: async ({}, use) => als.run({ app: 'alpha' }, () => use('store')),
        service: async ({ store }, use) => {
          console.log('>> service setup sees: ' + als.getStore()?.app)
          await use('service')
        },
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

test('fixture teardown still runs in its own store after the test', async () => {
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
