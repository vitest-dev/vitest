---
outline: deep
---

# Hooks

These functions allow you to hook into the life cycle of tests to avoid repeating setup and teardown code. They apply to the current context: the file if they are used at the top-level or the current suite if they are inside a `describe` block. These hooks are not called, when you are running Vitest as a [type checker](/guide/testing-types).

Test hooks are called in a stack order ("after" hooks are reversed) by default, but you can configure it via [`sequence.hooks`](/config/sequence#sequence-hooks) option.

## beforeEach

```ts
function beforeEach(
  body: (context: TestContext) => unknown,
  timeout?: number,
): void
```

Register a callback to be called before each of the tests in the current suite runs.
If the function returns a promise, Vitest waits until the promise resolve before running the test.

Optionally, you can pass a timeout (in milliseconds) defining how long to wait before terminating. The default is 10 seconds, and can be configured globally with [`hookTimeout`](/config/hooktimeout).

```ts
import { beforeEach } from 'vitest'

beforeEach(async () => {
  // Clear mocks and add some testing data before each test run
  await stopMocking()
  await addUser({ name: 'John' })
})
```

Here, the `beforeEach` ensures that user is added for each test.

`beforeEach` can also return an optional cleanup function (equivalent to [`afterEach`](#aftereach)):

```ts
import { beforeEach } from 'vitest'

beforeEach(async () => {
  // called once before each test run
  await prepareSomething()

  // clean up function, called once after each test run
  return async () => {
    await resetSomething()
  }
})
```

## afterEach

```ts
function afterEach(
  body: (context: TestContext) => unknown,
  timeout?: number,
): void
```

Register a callback to be called after each one of the tests in the current suite completes.
If the function returns a promise, Vitest waits until the promise resolve before continuing.

Optionally, you can provide a timeout (in milliseconds) for specifying how long to wait before terminating. The default is 10 seconds, and can be configured globally with [`hookTimeout`](/config/hooktimeout).

```ts
import { afterEach } from 'vitest'

afterEach(async () => {
  await clearTestingData() // clear testing data after each test run
})
```

Here, the `afterEach` ensures that testing data is cleared after each test runs.

::: tip
You can also use [`onTestFinished`](#ontestfinished) during the test execution to cleanup any state after the test has finished running.
:::

## beforeAll

```ts
function beforeAll(
  body: (context: ModuleContext) => unknown,
  timeout?: number,
): void
```

Register a callback to be called once before starting to run all tests in the current suite.
If the function returns a promise, Vitest waits until the promise resolve before running tests.

Optionally, you can provide a timeout (in milliseconds) for specifying how long to wait before terminating. The default is 10 seconds, and can be configured globally with [`hookTimeout`](/config/hooktimeout).

```ts
import { beforeAll } from 'vitest'

beforeAll(async () => {
  await startMocking() // called once before all tests run
})
```

Here the `beforeAll` ensures that the mock data is set up before tests run.

`beforeAll` can also return an optional cleanup function (equivalent to [`afterAll`](#afterall)):

```ts
import { beforeAll } from 'vitest'

beforeAll(async () => {
  // called once before all tests run
  await startMocking()

  // clean up function, called once after all tests run
  return async () => {
    await stopMocking()
  }
})
```

## afterAll

```ts
function afterAll(
  body: (context: ModuleContext) => unknown,
  timeout?: number,
): void
```

Register a callback to be called once after all tests have run in the current suite.
If the function returns a promise, Vitest waits until the promise resolve before continuing.

Optionally, you can provide a timeout (in milliseconds) for specifying how long to wait before terminating. The default is 10 seconds, and can be configured globally with [`hookTimeout`](/config/hooktimeout).

```ts
import { afterAll } from 'vitest'

afterAll(async () => {
  await stopMocking() // this method is called after all tests run
})
```

Here the `afterAll` ensures that `stopMocking` method is called after all tests run.

## aroundEach

```ts
function aroundEach(
  body: (
    runTest: () => Promise<void>,
    context: TestContext,
  ) => Promise<void>,
  timeout?: number,
): void
```

Register a callback function that wraps around each test within the current suite. The callback receives a `runTest` function that **must** be called to run the test.

The `runTest()` function runs `beforeEach` hooks, the test itself, fixtures accessed in the test, and `afterEach` hooks. Fixtures that are accessed in the `aroundEach` callback are initialized before `runTest()` is called and are torn down after the aroundEach teardown code completes, allowing you to safely use them in both setup and teardown phases.

::: warning
You **must** call `runTest()` within your callback. If `runTest()` is not called, the test will fail with an error.
:::

Optionally, you can provide a timeout (in milliseconds) for specifying how long to wait before terminating. The timeout applies independently to the setup phase (before `runTest()`) and teardown phase (after `runTest()`). The default is 10 seconds, and can be configured globally with [`hookTimeout`](/config/hooktimeout).

```ts
import { aroundEach, test } from 'vitest'

aroundEach(async (runTest) => {
  await db.transaction(runTest)
})

test('insert user', async () => {
  await db.insert({ name: 'Alice' })
  // transaction is automatically rolled back after the test
})
```

::: tip When to use `aroundEach`
Use `aroundEach` when your test needs to run **inside a context** that wraps around it, such as:
- Wrapping tests in [AsyncLocalStorage](https://nodejs.org/api/async_context.html#class-asynclocalstorage) context
- Wrapping tests with tracing spans
- Database transactions

If you just need to run code before and after tests, prefer using [`beforeEach`](#beforeeach) with a cleanup return function:
```ts
beforeEach(async () => {
  await database.connect()
  return async () => {
    await database.disconnect()
  }
})
```
:::

### Multiple Hooks

When multiple `aroundEach` hooks are registered, they are nested inside each other. The first registered hook is the outermost wrapper:

```ts
aroundEach(async (runTest) => {
  console.log('outer before')
  await runTest()
  console.log('outer after')
})

aroundEach(async (runTest) => {
  console.log('inner before')
  await runTest()
  console.log('inner after')
})

// Output order:
//  outer before
//    inner before
//      test
//    inner after
//  outer after
```

### Context and Fixtures

The callback receives the test context as the second argument which means that you can use fixtures with `aroundEach`:

```ts
import { aroundEach, test as base } from 'vitest'

const test = base.extend<{ db: Database; user: User }>({
  db: async ({}, use) => {
    // db is created before `aroundEach` hook
    const db = await createTestDatabase()
    await use(db)
    await db.close()
  },
  user: async ({ db }, use) => {
    // `user` runs as part of the transaction
    // because it's accessed inside the `test`
    const user = await db.createUser()
    await use(user)
  },
})

// note that `aroundEach` is available on test
// for a better TypeScript support of fixtures
test.aroundEach(async (runTest, { db }) => {
  await db.transaction(runTest)
})

test('insert user', async ({ db, user }) => {
  await db.insert(user)
})
```

## aroundAll

```ts
function aroundAll(
  body: (
    runSuite: () => Promise<void>,
    context: ModuleContext,
  ) => Promise<void>,
  timeout?: number,
): void
```

Register a callback function that wraps around all tests within the current suite. The callback receives a `runSuite` function that **must** be called to run the suite's tests.

The `runSuite()` function runs all tests in the suite, including `beforeAll`/`afterAll`/`beforeEach`/`afterEach` hooks, `aroundEach` hooks, and fixtures.

::: warning
You **must** call `runSuite()` within your callback. If `runSuite()` is not called, the hook will fail with an error and all tests in the suite will be skipped.
:::

Optionally, you can provide a timeout (in milliseconds) for specifying how long to wait before terminating. The timeout applies independently to the setup phase (before `runSuite()`) and teardown phase (after `runSuite()`). The default is 10 seconds, and can be configured globally with [`hookTimeout`](/config/hooktimeout).

```ts
import { aroundAll, test } from 'vitest'

aroundAll(async (runSuite) => {
  await tracer.trace('test-suite', runSuite)
})

test('test 1', () => {
  // Runs within the tracing span
})

test('test 2', () => {
  // Also runs within the same tracing span
})
```

::: tip When to use `aroundAll`
Use `aroundAll` when your suite needs to run **inside a context** that wraps around all tests, such as:
- Wrapping an entire suite in [AsyncLocalStorage](https://nodejs.org/api/async_context.html#class-asynclocalstorage) context
- Wrapping a suite with tracing spans
- Database transactions

If you just need to run code once before and after all tests, prefer using [`beforeAll`](#beforeall) with a cleanup return function:
```ts
beforeAll(async () => {
  await server.start()
  return async () => {
    await server.stop()
  }
})
```
:::

### Multiple Hooks

When multiple `aroundAll` hooks are registered, they are nested inside each other. The first registered hook is the outermost wrapper:

```ts
aroundAll(async (runSuite) => {
  console.log('outer before')
  await runSuite()
  console.log('outer after')
})

aroundAll(async (runSuite) => {
  console.log('inner before')
  await runSuite()
  console.log('inner after')
})

// Output order: outer before → inner before → tests → inner after → outer after
```

Each suite has its own independent `aroundAll` hooks. Parent suite's `aroundAll` wraps around child suite's execution:

```ts
import { AsyncLocalStorage } from 'node:async_hooks'
import { aroundAll, describe, test } from 'vitest'

const context = new AsyncLocalStorage<{ suiteId: string }>()

aroundAll(async (runSuite) => {
  await context.run({ suiteId: 'root' }, runSuite)
})

test('root test', () => {
  // context.getStore() returns { suiteId: 'root' }
})

describe('nested', () => {
  aroundAll(async (runSuite) => {
    // Parent's context is available here
    await context.run({ suiteId: 'nested' }, runSuite)
  })

  test('nested test', () => {
    // context.getStore() returns { suiteId: 'nested' }
  })
})
```

## Test Hooks

Vitest provides a few hooks that you can call _during_ the test execution to cleanup the state when the test has finished running.

::: warning
These hooks will throw an error if they are called outside of the test body.
:::

### onTestFinished {#ontestfinished}

This hook is always called after the test has finished running. It is called after `afterEach` hooks since they can influence the test result. It receives an `TestContext` object like `beforeEach` and `afterEach`.

```ts {1,5}
import { onTestFinished, test } from 'vitest'

test('performs a query', () => {
  const db = connectDb()
  onTestFinished(() => db.close())
  db.query('SELECT * FROM users')
})
```

::: warning
If you are running tests concurrently, you should always use `onTestFinished` hook from the test context since Vitest doesn't track concurrent tests in global hooks:

```ts {3,5}
import { test } from 'vitest'

test.concurrent('performs a query', ({ onTestFinished }) => {
  const db = connectDb()
  onTestFinished(() => db.close())
  db.query('SELECT * FROM users')
})
```
:::

This hook is particularly useful when creating reusable logic:

```ts
// this can be in a separate file
function getTestDb() {
  const db = connectMockedDb()
  onTestFinished(() => db.close())
  return db
}

test('performs a user query', async () => {
  const db = getTestDb()
  expect(
    await db.query('SELECT * from users').perform()
  ).toEqual([])
})

test('performs an organization query', async () => {
  const db = getTestDb()
  expect(
    await db.query('SELECT * from organizations').perform()
  ).toEqual([])
})
```

It is also a good practice to cleanup your spies after each test, so they don't leak into other tests. You can do so by enabling [`restoreMocks`](/config/restoremocks) config globally, or restoring the spy inside `onTestFinished` (if you try to restore the mock at the end of the test, it won't be restored if one of the assertions fails - using `onTestFinished` ensures the code always runs):

```ts
import { onTestFinished, test } from 'vitest'

test('performs a query', () => {
  const spy = vi.spyOn(db, 'query')
  onTestFinished(() => spy.mockClear())

  db.query('SELECT * FROM users')
  expect(spy).toHaveBeenCalled()
})
```

::: tip
This hook is always called in reverse order and is not affected by [`sequence.hooks`](/config/sequence#sequence-hooks) option.
:::

### onTestFailed

This hook is called only after the test has failed. It is called after `afterEach` hooks since they can influence the test result. It receives a `TestContext` object like `beforeEach` and `afterEach`. This hook is useful for debugging.

```ts {1,5-7}
import { onTestFailed, test } from 'vitest'

test('performs a query', () => {
  const db = connectDb()
  onTestFailed(({ task }) => {
    console.log(task.result.errors)
  })
  db.query('SELECT * FROM users')
})
```

::: warning
If you are running tests concurrently, you should always use `onTestFailed` hook from the test context since Vitest doesn't track concurrent tests in global hooks:

```ts {3,5-7}
import { test } from 'vitest'

test.concurrent('performs a query', ({ onTestFailed }) => {
  const db = connectDb()
  onTestFailed(({ task }) => {
    console.log(task.result.errors)
  })
  db.query('SELECT * FROM users')
})
```
:::
