---
title: Test Context | Guide
outline: deep
---

# Test Context

Inspired by [Playwright Fixtures](https://playwright.dev/docs/test-fixtures), Vitest's test context allows you to define utils, states, and fixtures that can be used in your tests.

## Usage

The first argument for each test callback is a test context.

```ts
import { it } from 'vitest'

it('should work', ({ task }) => {
  // prints name of the test
  console.log(task.name)
})
```

## Built-in Test Context

#### `task`

A readonly object containing metadata about the test.

#### `expect`

The `expect` API bound to the current test:

```ts
import { it } from 'vitest'

it('math is easy', ({ expect }) => {
  expect(2 + 2).toBe(4)
})
```

This API is useful for running snapshot tests concurrently because global expect cannot track them:

```ts
import { it } from 'vitest'

it.concurrent('math is easy', ({ expect }) => {
  expect(2 + 2).toMatchInlineSnapshot()
})

it.concurrent('math is hard', ({ expect }) => {
  expect(2 * 2).toMatchInlineSnapshot()
})
```

#### `skip`

```ts
function skip(note?: string): never
function skip(condition: boolean, note?: string): void
```

Skips subsequent test execution and marks test as skipped:

```ts
import { expect, it } from 'vitest'

it('math is hard', ({ skip }) => {
  skip()
  expect(2 + 2).toBe(5)
})
```

Since Vitest 3.1, it accepts a boolean parameter to skip the test conditionally:

```ts
it('math is hard', ({ skip, mind }) => {
  skip(mind === 'foggy')
  expect(2 + 2).toBe(5)
})
```

#### `annotate` <Version>3.2.0</Version> {#annotate}

```ts
function annotate(
  message: string,
  attachment?: TestAttachment,
): Promise<TestAnnotation>

function annotate(
  message: string,
  type?: string,
  attachment?: TestAttachment,
): Promise<TestAnnotation>
```

Add a [test annotation](/guide/test-annotations) that will be displayed by your [reporter](/config/reporters).

```ts
test('annotations API', async ({ annotate }) => {
  await annotate('https://github.com/vitest-dev/vitest/pull/7953', 'issues')
})
```

#### `signal` <Version>3.2.0</Version> {#signal}

An [`AbortSignal`](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal) that can be aborted by Vitest. The signal is aborted in these situations:

- Test times out
- User manually cancelled the test run with Ctrl+C
- [`vitest.cancelCurrentRun`](/api/advanced/vitest#cancelcurrentrun) was called programmatically
- Another test failed in parallel and the [`bail`](/config/bail) flag is set

```ts
it('stop request when test times out', async ({ signal }) => {
  await fetch('/resource', { signal })
}, 2000)
```

#### `onTestFailed`

The [`onTestFailed`](/api/hooks#ontestfailed) hook bound to the current test. This API is useful if you are running tests concurrently and need to have a special handling only for this specific test.

#### `onTestFinished`

The [`onTestFinished`](/api/hooks#ontestfailed) hook bound to the current test. This API is useful if you are running tests concurrently and need to have a special handling only for this specific test.

## Extend Test Context

Vitest allows you to extend the test context with custom fixtures using `test.extend`.

The `test.extend` method lets you create a custom test API with fixtures - reusable values that are automatically set up and torn down for your tests. Vitest supports two syntaxes: the builder pattern (recommended) and the object syntax (Playwright-compatible).

### Builder Pattern <Version>4.1.0</Version> {#builder-pattern}

The builder pattern is the recommended way to define fixtures because it provides automatic type inference. TypeScript infers the type of each fixture from its return value, so you don't need to declare types manually.

```ts [my-test.ts]
import { test as baseTest } from 'vitest'

export const test = baseTest
  // Simple value - type is inferred as { port: number; host: string }
  .extend('config', { port: 3000, host: 'localhost' })
  // Function fixture - type is inferred from return value
  .extend('server', async ({ config }) => {
    // TypeScript knows config is { port: number; host: string }
    return `http://${config.host}:${config.port}`
  })
```

Then use it in your tests:

```ts [my-test.test.ts]
import { expect } from 'vitest'
import { test } from './my-test.js'

test('server uses correct port', ({ config, server }) => {
  // TypeScript knows the types:
  // - config is { port: number; host: string }
  // - server is string
  expect(server).toBe('http://localhost:3000')
  expect(config.port).toBe(3000)
})
```

#### Setup and Cleanup with `onCleanup`

For fixtures that need setup or cleanup logic, use a function. The `onCleanup` callback registers teardown logic that runs after the fixture's scope ends:

```ts
import { test as baseTest } from 'vitest'

export const test = baseTest
  .extend('tempFile', async ({}, { onCleanup }) => {
    const filePath = `/tmp/test-${Date.now()}.txt`
    await fs.writeFile(filePath, 'test data')

    // Register cleanup - runs after test completes
    onCleanup(async () => {
      await fs.unlink(filePath)
    })

    return filePath
  })
```

For more complex examples:

```ts
const test = baseTest
  .extend('database', { scope: 'file' }, async ({}, { onCleanup }) => {
    const db = await createDatabase()
    await db.connect()

    onCleanup(async () => {
      await db.disconnect()
    })

    return db
  })
  .extend('user', async ({ database }, { onCleanup }) => {
    const user = await database.createTestUser()

    onCleanup(async () => {
      await database.deleteUser(user.id)
    })

    return user
  })
```

::: warning
The `onCleanup` function can only be called **once per fixture**. If you need multiple cleanup operations, either combine them into a single cleanup function, or split your fixture into multiple smaller fixtures:

```ts
// ❌ This will throw an error
const test = baseTest
  .extend('resources', async ({}, { onCleanup }) => {
    const a = await acquireA()
    onCleanup(() => releaseA(a))

    const b = await acquireB()
    onCleanup(() => releaseB(b)) // Error: onCleanup can only be called once

    return { a, b }
  })

// ✅ Split into separate fixtures (recommended)
const test = baseTest
  .extend('resourceA', async ({}, { onCleanup }) => {
    const a = await acquireA()
    onCleanup(() => releaseA(a))
    return a
  })
  .extend('resourceB', async ({}, { onCleanup }) => {
    const b = await acquireB()
    onCleanup(() => releaseB(b))
    return b
  })
```

Splitting into separate fixtures is the recommended approach as it provides better isolation and makes dependencies explicit.
:::

#### Fixture Options

The second argument to `.extend()` accepts options:

```ts
const test = baseTest
  // Automatic fixture - runs for every test even if not used
  .extend('metrics', { auto: true }, ({}, { onCleanup }) => {
    const metrics = new MetricsCollector()
    metrics.start()
    onCleanup(() => metrics.stop())
    return metrics
  })
  // Worker-scoped fixture - initialized once per worker
  .extend('config', { scope: 'worker' }, () => {
    return loadConfig()
  })
  // File-scoped fixture - initialized once per file
  .extend('database', { scope: 'file' }, async ({ config }, { onCleanup }) => {
    const db = await createDatabase(config)
    onCleanup(() => db.close())
    return db
  })
  // Injected fixture - can be overridden via config
  .extend('baseUrl', { injected: true }, () => {
    return 'http://localhost:3000'
  })
```

For test-scoped fixtures (the default), you can omit the options:

```ts
const test = baseTest
  .extend('simple', () => 'value')
```

#### Accessing Other Fixtures

Each fixture can access previously defined fixtures via its first parameter. This works for both function and non-function fixtures:

```ts
const test = baseTest
  .extend('config', { apiUrl: 'https://api.example.com', port: 3000 })
  .extend('client', ({ config }) => {
    // TypeScript knows config is { apiUrl: string; port: number }
    return new ApiClient(config.apiUrl)
  })
  .extend('user', async ({ client }) => {
    // TypeScript knows client is ApiClient
    return await client.getCurrentUser()
  })
```

#### Object Syntax (Playwright-Compatible)

Vitest also supports a Playwright-compatible object syntax. This is useful if you're migrating from Playwright or prefer defining all fixtures at once:

```ts [my-test.ts]
import { test as baseTest } from 'vitest'

export const test = baseTest.extend({
  page: async ({}, use) => {
    // setup the fixture before each test function
    const page = await browser.newPage()

    // use the fixture value
    await use(page)

    // cleanup the fixture after each test function
    await page.close()
  },
  baseUrl: 'http://localhost:3000'
})
```

The key difference from the builder pattern is the `use()` callback pattern for cleanup:

```ts
// Object syntax: cleanup code goes AFTER use()
const test = baseTest.extend({
  database: async ({}, use) => {
    const db = await createDatabase()
    await db.connect()

    await use(db) // Test runs here

    // Cleanup after the test
    await db.disconnect()
  }
})

// Builder pattern: cleanup is registered with onCleanup()
const test = baseTest
  .extend('database', async ({}, { onCleanup }) => {
    const db = await createDatabase()
    await db.connect()

    onCleanup(() => db.disconnect())

    return db // Test runs after this returns
  })
```

::: info
With the object syntax, you need to provide types manually as a generic parameter since TypeScript cannot infer them from the `use()` callback:

```ts
const test = baseTest.extend<{
  page: Page
  baseUrl: string
}>({
  page: async ({}, use) => {
    const page = await browser.newPage()
    await use(page)
    await page.close()
  },
  baseUrl: 'http://localhost:3000'
})
```
:::

#### Tuple Syntax for Options

With the object syntax, use a tuple to specify fixture options:

```ts
const test = baseTest.extend({
  // Auto fixture
  fixture: [
    async ({}, use) => {
      setup()
      await use()
      teardown()
    },
    { auto: true }
  ],
  // Scoped fixture
  database: [
    async ({}, use) => {
      const db = await createDatabase()
      await use(db)
      await db.close()
    },
    { scope: 'file' }
  ],
  // Injected fixture
  url: [
    '/default',
    { injected: true }
  ],
})
```

### Fixture Initialization

Vitest runner will smartly initialize your fixtures and inject them into the test context based on usage.

```ts
import { test as baseTest } from 'vitest'

const test = baseTest
  .extend('database', async () => {
    console.log('database initializing')
    return createDatabase()
  })
  .extend('cache', async () => {
    return createCache()
  })

// database will not run
test('no fixtures needed', () => {})
test('only cache', ({ cache }) => {})

// database will run
test('needs database', ({ database }) => {})
```

::: warning
When using `test.extend()` with fixtures, you should always use the object destructuring pattern `{ database }` to access context both in fixture function and test function.

```ts
test('context must be destructured', (context) => { // [!code --]
  expect(context.database).toBeDefined()
})

test('context must be destructured', ({ database }) => { // [!code ++]
  expect(database).toBeDefined()
})
```
:::

### Extending Extended Tests

You can extend an already extended test to add more fixtures:

```ts
import { test as dbTest } from './my-test.js'

export const test = dbTest
  .extend('user', ({ database }) => {
    return database.createUser()
  })
```

With the object syntax:

```ts
import { test as dbTest } from './my-test.js'

export const test = dbTest.extend({
  admin: async ({ database }, use) => {
    const admin = await database.createAdmin()
    await use(admin)
    await database.deleteUser(admin.id)
  }
})
```

### Mixing Both Syntaxes

You can combine both approaches. The builder pattern can be chained after object-based extensions:

```ts
const test = baseTest
  // Object syntax for simple fixtures
  .extend<{ apiKey: string }>({
    apiKey: 'test-key-123',
  })
  // Builder pattern for complex fixtures with inference
  .extend('client', ({ apiKey }) => {
    // TypeScript knows apiKey is string
    return new ApiClient(apiKey)
  })
```

### Fixture Scopes <Version>3.2.0</Version> {#fixture-scopes}

By default, fixtures are initialized for each test. You can change this with the `scope` option to share fixtures across tests.

::: warning
By default any fixture without a scope is treated as a `test` fixture. This means that you cannot use it inside `worker` and `file` scopes. If you wish to access it there, consider specifying a scope manually:

```ts
test
  .extend('port', { scope: 'worker' }, 5000)
  .extend('db', { scope: 'worker' }, async ({ port }) => {
    return createDb(port)
  })
```

Note that you cannot override non-test fixtures inside `describe` blocks:

```ts
test.describe('a nested suite', () => {
  test.override('port', { scope: 'worker' }, 3000) // throws an error
})
```

Consider overriding it on the top level of the module, or by using [`injected`](#default-fixture-injected) option and providing the value in the project config.

Also note that in [non-isolate](/config/isolate) mode overriding a `worker` fixture will affect the fixture value in all test files running after it was overriden.
:::

#### Test Scope (Default)

Test-scoped fixtures are created fresh for each test:

```ts
const test = baseTest
  .extend('counter', () => {
    return { value: 0 }
  })

test('first test', ({ counter }) => {
  counter.value++
  expect(counter.value).toBe(1)
})

test('second test', ({ counter }) => {
  // Fresh instance, value is 0 again
  expect(counter.value).toBe(0)
})
```

Test-scoped fixtures have access to the [built-in test context](#built-in-test-context) (`task`, `expect`, `skip`, etc.):

```ts
const test = baseTest
  .extend('testInfo', ({ task }) => {
    return { name: task.name }
  })
```

#### File Scope

File-scoped fixtures are initialized once per test file:

```ts
const test = baseTest
  .extend('database', { scope: 'file' }, async ({}, { onCleanup }) => {
    const db = await createDatabase()
    onCleanup(() => db.close())
    return db
  })

test('first test', ({ database }) => {
  // Uses the same database instance
})

test('second test', ({ database }) => {
  // Same database instance as first test
})
```

#### Worker Scope

Worker-scoped fixtures are initialized once per worker process:

```ts
const test = baseTest
  .extend('config', { scope: 'worker' }, () => {
    return await loadExpensiveConfig()
  })
```

::: info
By default, every file runs in a separate worker, so `file` and `worker` scopes work the same way. However, if you disable [isolation](/config/isolate), then the number of workers is limited by [`maxWorkers`](/config/maxworkers), and worker-scoped fixtures will be shared across files running in the same worker.

When running tests in `vmThreads` or `vmForks`, `scope: 'worker'` works the same way as `scope: 'file'` because each file has its own VM context.
:::

#### Scope Hierarchy

Fixtures can only access other fixtures from the same or higher (longer-lived) scopes:

| Fixture Scope | Can Access |
|---------------|------------|
| `worker` | Only other worker fixtures |
| `file` | Worker + file fixtures |
| `test` | Worker + file + test fixtures + [test context](#built-in-test-context) |

```ts
const test = baseTest
  .extend('config', { scope: 'worker' }, () => {
    return { apiUrl: 'https://api.example.com' }
  })
  .extend('database', { scope: 'file' }, async ({ config }, { onCleanup }) => {
    // ✅ File fixture can access worker fixture
    const db = await createDatabase(config.apiUrl)
    onCleanup(() => db.close())
    return db
  })
  .extend('user', async ({ database, task }) => {
    // ✅ Test fixture can access file fixture AND test context
    return await database.createUser(task.name)
  })
```

::: tip
Only test-scoped fixtures have access to the [built-in test context](#built-in-test-context) (`task`, `expect`, `skip`, etc.). Worker and file fixtures run outside of any specific test, so test-specific properties are not available to them.

If you need the file path in a file-scoped fixture, use `expect.getState().testPath` instead.
:::

#### Type-Safe Scope Access <Version>3.2.0</Version> {#type-safe-scope-access}

With the builder pattern, TypeScript automatically enforces scope-based access rules. If you try to access a test-scoped fixture from a file-scoped fixture, you'll get a compile-time error.

If you're using the object syntax and want the same type safety, you can use the `$worker`, `$file`, and `$test` keys to explicitly declare which fixtures belong to which scope:

```ts
const test = baseTest.extend<{
  $worker: { config: Config }
  $file: { database: Database }
  $test: { user: User }
}>({
  config: [async ({}, use) => {
    await use(loadConfig())
  }, { scope: 'worker' }],

  database: [async ({ config }, use) => {
    const db = await createDatabase(config)
    await use(db)
    await db.close()
  }, { scope: 'file' }],

  user: async ({ database }, use) => {
    const user = await database.createUser()
    await use(user)
    await database.deleteUser(user.id)
  },
})
```

This provides the same compile-time safety as the builder pattern, catching scope violations at build time rather than runtime.

### Default Fixture (Injected)

Since Vitest 3, you can provide different values in different [projects](/guide/projects). To enable this, pass `{ injected: true }` in the options. If the key is not specified in the [project configuration](/config/provide), the default value will be used.

:::code-group
```ts [fixtures.test.ts]
import { test as baseTest } from 'vitest'

const test = baseTest
  .extend('url', { injected: true }, '/default')

test('works correctly', ({ url }) => {
  // url is "/default" in "project-new"
  // url is "/full" in "project-full"
  // url is "/empty" in "project-empty"
})
```
```ts [vitest.config.ts]
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'project-new',
        },
      },
      {
        test: {
          name: 'project-full',
          provide: {
            url: '/full',
          },
        },
      },
      {
        test: {
          name: 'project-empty',
          provide: {
            url: '/empty',
          },
        },
      },
    ],
  },
})
```
:::

### Overriding Fixture Values <Version>4.1.0</Version> {#overriding-fixture-values}

You can override fixture values for a specific suite and its children using `test.override`. This is useful when you need different fixture values for different test scenarios.

::: tip
Vitest will automatically inherit the options, if they are not provided when overriding. Note that you cannot override fixture's `scope` or `auto` options.
:::

#### Builder Pattern (Recommended)

```ts
import { test as baseTest, describe, expect } from 'vitest'

const test = baseTest
  .extend('config', { port: 3000, host: 'localhost' })
  .extend('server', ({ config }) => `http://${config.host}:${config.port}`)

describe('production environment', () => {
  // Override with a new static value (chainable)
  test
    .override('config', { port: 8080, host: 'api.example.com' })

  test('uses production config', ({ server }) => {
    expect(server).toBe('http://api.example.com:8080')
  })
})

describe('with custom server', () => {
  // Override with a function that can access other fixtures
  test.override('server', ({ config }) => {
    return `https://${config.host}:${config.port}/v2`
  })

  test('uses custom server', ({ server }) => {
    expect(server).toBe('https://localhost:3000/v2')
  })
})

test('uses default values', ({ server }) => {
  expect(server).toBe('http://localhost:3000')
})
```

#### Chaining Multiple Overrides

`test.override` returns the test API, so you can chain multiple calls:

```ts
describe('production environment', () => {
  test
    .override('environment', 'production')
    .override('port', 8080)
    .override('debug', false)

  test('uses production settings', ({ environment, port, debug }) => {
    expect(environment).toBe('production')
    expect(port).toBe(8080)
    expect(debug).toBe(false)
  })
})
```

#### Object Syntax

You can also use object syntax to override multiple fixtures at once:

```ts
describe('different configuration', () => {
  test.override({
    config: { port: 4000, host: 'test.local' },
  })

  test('uses overwritten config', ({ config }) => {
    expect(config.port).toBe(4000)
  })
})
```

#### With Cleanup

When overwriting with a function, you can use `onCleanup` just like in `test.extend`:

```ts
describe('with custom database', () => {
  test.override('database', async ({ config }, { onCleanup }) => {
    const db = await createTestDatabase(config)
    onCleanup(() => db.drop())
    return db
  })

  test('uses custom database', ({ database }) => {
    // Uses the overwritten database
  })
})
```

#### Nested Scopes

Overrides are inherited by nested suites and can be overwritten again:

```ts
describe('level 1', () => {
  test.override('value', 'one')

  test('uses level 1 value', ({ value }) => {
    expect(value).toBe('one')
  })

  describe('level 2', () => {
    test.override('value', 'two')

    test('uses level 2 value', ({ value }) => {
      expect(value).toBe('two')
    })
  })

  test('still uses level 1 value', ({ value }) => {
    expect(value).toBe('one')
  })
})
```

::: warning
Note that you cannot introduce new fixtures inside `test.override`. Extend the test context with `test.extend` instead.
:::

::: info
`test.scoped` is deprecated in favor of `test.override`. The `test.scoped` API still works but will be removed in a future version.
:::

### Type-Safe Hooks

When using `test.extend`, the extended `test` object provides type-safe hooks that are aware of the extended context:

```ts
const test = baseTest
  .extend('counter', { value: 0, increment() { this.value++ } })

// Unlike global hooks, these hooks are aware of the extended context
test.beforeEach(({ counter }) => {
  counter.increment()
})

test.afterEach(({ counter }) => {
  console.log('Final count:', counter.value)
})
```

#### Suite-Level Hooks with Fixtures <Version>4.1.0</Version> {#suite-level-hooks}

The extended `test` object also provides [`beforeAll`](/api/hooks#beforeall), [`afterAll`](/api/hooks#afterall), and [`aroundAll`](/api/hooks#aroundall) hooks that can access file-scoped and worker-scoped fixtures:

```ts
const test = baseTest
  .extend('config', { scope: 'file' }, () => loadConfig())
  .extend('database', { scope: 'file' }, async ({ config }, { onCleanup }) => {
    const db = await createDatabase(config)
    onCleanup(() => db.close())
    return db
  })

// Access file-scoped fixtures in suite-level hooks
test.aroundAll(async (runSuite, { database }) => {
  await database.transaction(runSuite)
})

test.beforeAll(async ({ database }) => {
  await database.createUsers()
})

test.afterAll(async ({ database }) => {
  await database.removeUsers()
})
```

::: warning IMPORTANT
Suite-level hooks (`beforeAll`, `afterAll`, `aroundAll`) **must be called on the `test` object returned from `test.extend()`** to have access to the extended fixtures. Using the global `beforeAll`/`afterAll`/`aroundAll` functions will not have access to your custom fixtures:

```ts
import { test as baseTest, beforeAll } from 'vitest'

const test = baseTest
  .extend('database', { scope: 'file' }, async ({}, { onCleanup }) => {
    const db = await createDatabase()
    onCleanup(() => db.close())
    return db
  })

// ❌ WRONG: Global beforeAll doesn't have access to 'database'
beforeAll(({ database }) => {
  // Error: 'database' is undefined
})

// ✅ CORRECT: Use test.beforeAll to access fixtures
test.beforeAll(({ database }) => {
  // 'database' is available
})
```

This applies to all suite-level hooks: `beforeAll`, `afterAll`, and `aroundAll`.
:::

::: tip
Suite-level hooks can only access [**file-scoped** and **worker-scoped** fixtures](#fixture-scopes). Test-scoped fixtures are not available in these hooks because they run outside the context of individual tests. If you try to access a test-scoped fixture in a suite-level hook, Vitest will throw an error.

```ts
const test = baseTest
  .extend('testFixture', () => 'test-scoped')
  .extend('fileFixture', { scope: 'file' }, () => 'file-scoped')

// ❌ Error: test-scoped fixtures not available in beforeAll
test.beforeAll(({ testFixture }) => {})

// ✅ Works: file-scoped fixtures are available
test.beforeAll(({ fileFixture }) => {})
```
:::
