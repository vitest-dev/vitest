---
title: Setup and Teardown | Guide
prev:
  text: Testing Asynchronous Code
  link: /guide/learn/async
next:
  text: Mock Functions
  link: /guide/learn/mock-functions
---

# Setup and Teardown

Often while writing tests, you need to do some work before tests run (initialize data, connect to a database, start a server) and clean up afterwards. Rather than duplicating this code in every test, Vitest provides lifecycle hooks that run automatically at the right time.

## Repeating Setup for Each Test

The most common hooks are [`beforeEach`](/api/hooks#beforeeach) and [`afterEach`](/api/hooks#aftereach). As the names suggest, `beforeEach` runs before every test in the file, and `afterEach` runs after every test, even if the test fails. This makes them perfect for ensuring each test starts with a known state.

```js
import { afterEach, beforeEach, expect, test } from 'vitest'

let items

beforeEach(() => {
  items = ['apple', 'banana', 'cherry']
})

afterEach(() => {
  items = []
})

test('items starts with 3 fruits', () => {
  expect(items).toHaveLength(3)
})

test('can add an item', () => {
  items.push('date')
  expect(items).toHaveLength(4)
  // afterEach will reset items for the next test,
  // so this mutation won't leak into other tests
})
```

Without these hooks, the second test's `push` would affect any test that runs after it, which is a classic source of flaky tests. The hooks guarantee clean state for every test.

## One-Time Setup

Some setup is too expensive to repeat for every test. If you need to connect to a database, start a server, or load a large file, doing that before every test would slow your suite down dramatically. That's what [`beforeAll`](/api/hooks#beforeall) and [`afterAll`](/api/hooks#afterall) are for. They run once for the entire file:

```js
import { afterAll, beforeAll, expect, test } from 'vitest'

let db

beforeAll(async () => {
  db = await connectToDatabase()
})

afterAll(async () => {
  await db.close()
})

test('can query users', async () => {
  const users = await db.query('SELECT * FROM users')
  expect(users.length).toBeGreaterThan(0)
})

test('can query products', async () => {
  const products = await db.query('SELECT * FROM products')
  expect(products.length).toBeGreaterThan(0)
})
```

The database connection is created once, shared across all tests, and then closed when the file finishes running.

## Scoping with `describe`

Hooks defined inside a `describe` block only apply to the tests within that block. Top-level hooks apply to every test in the file. This lets you set up different state for different groups of tests:

```js
import { beforeEach, describe, expect, test } from 'vitest'

describe('math operations', () => {
  let value

  beforeEach(() => {
    value = 0
  })

  test('can add', () => {
    value += 5
    expect(value).toBe(5)
  })

  test('can subtract', () => {
    value -= 3
    expect(value).toBe(-3) // value was reset to 0 by beforeEach
  })
})

describe('string operations', () => {
  let text

  beforeEach(() => {
    text = 'hello'
  })

  test('can uppercase', () => {
    expect(text.toUpperCase()).toBe('HELLO')
  })
})
```

Each `describe` block has its own `beforeEach` that only affects the tests inside it. The string tests don't know or care about the `value` variable, and vice versa.

## Execution Order

When you have hooks at multiple levels, it's helpful to understand the order they run in. Top-level hooks wrap around inner hooks, forming a nesting structure:

```js
import { afterAll, afterEach, beforeAll, beforeEach, describe, test } from 'vitest'

beforeAll(() => console.log('1 - beforeAll'))
afterAll(() => console.log('8 - afterAll'))
beforeEach(() => console.log('2 - beforeEach'))
afterEach(() => console.log('5 - afterEach'))

describe('suite', () => {
  beforeEach(() => console.log('3 - inner beforeEach'))
  afterEach(() => console.log('4 - inner afterEach'))

  test('first test', () => {
    console.log('  first test')
  })

  test('second test', () => {
    console.log('  second test')
  })
})
```

This produces the following output:

```
1 - beforeAll
2 - beforeEach
3 - inner beforeEach
  first test
4 - inner afterEach
5 - afterEach
2 - beforeEach
3 - inner beforeEach
  second test
4 - inner afterEach
5 - afterEach
8 - afterAll
```

Notice the pattern: `beforeAll` and `afterAll` run once for the entire suite, while `beforeEach` and `afterEach` repeat for every test. Within each test, outer `beforeEach` runs first (setting up the broadest context), then inner `beforeEach` runs (narrowing the context). After the test, the order reverses: inner `afterEach` cleans up the narrow context first, then outer `afterEach` handles the broader cleanup.

## Cleanup with `onTestFinished`

Sometimes you create a resource inside a test that needs to be cleaned up afterwards. You could use `afterEach`, but that means the cleanup is separated from the setup, which can make the test harder to follow. [`onTestFinished`](/api/hooks#ontestfinished) lets you register a cleanup function right where you create the resource:

```js
import { expect, onTestFinished, test } from 'vitest'

test('creates a temporary file', () => {
  const file = createTempFile()
  onTestFinished(() => {
    deleteTempFile(file)
  })

  expect(file.exists()).toBe(true)
})
```

A similar pattern works with `beforeEach`. You can return a cleanup function and Vitest will call it after each test. This is especially nice when the setup and teardown are closely related:

```js
import { beforeEach } from 'vitest'

beforeEach(() => {
  const server = startServer()
  return () => {
    server.close()
  }
})
```

## Fixtures with `test.extend`

The examples above use `let` variables and `beforeEach` to set up shared state. This works, but it has some downsides: the variable declarations are separated from the initialization, the types require explicit annotation, and it's easy to forget to clean up.

Vitest offers a better pattern for this with [`test.extend`](/guide/test-context#extend-test-context). You define reusable **fixtures** that are automatically created for each test and cleaned up afterwards:

```js [my-test.js]
import { test as baseTest } from 'vitest'

export const test = baseTest
  .extend('db', async ({}, { onCleanup }) => {
    const db = await createDatabase()
    onCleanup(() => db.close())
    return db
  })
  .extend('user', async ({ db }) => {
    return await db.createUser({ name: 'Alice' })
  })
```

```js [my-test.test.js]
import { expect } from 'vitest'
import { test } from './my-test.js'

test('user is created', ({ db, user }) => {
  expect(user.name).toBe('Alice')
})
```

Fixtures are only initialized when a test actually uses them (by destructuring them from the context), and they can depend on each other. This makes them a great alternative to `beforeEach`/`afterEach` for most setup and teardown patterns.

See the [Test Context](/guide/test-context) guide for the full details on fixtures, scoping, and overrides.

## Setup Files

If you have setup code that should run before every test file in your project (things like polyfills, global configuration, or custom matchers), you can put it in a setup file and point to it with the [`setupFiles`](/config/setupfiles) config option:

```js [vitest.config.js]
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    setupFiles: ['./test/setup.js'],
  },
})
```

```js [test/setup.js]
// This runs before every test file
import { expect } from 'vitest'
import { customMatchers } from './custom-matchers.js'

expect.extend(customMatchers)
```

Unlike `beforeAll`, which runs once per file, setup files run in a separate phase before the test file even starts being collected. This makes them the right place for things like extending the `expect` API or configuring global polyfills.

::: tip
For advanced cases where your test needs to run *inside* a wrapping context (like a database transaction or a tracing span), see the [`aroundEach`](/api/hooks#aroundeach) and [`aroundAll`](/api/hooks#aroundall) hooks. For the complete lifecycle picture, see [Test Run Lifecycle](/guide/lifecycle).
:::
