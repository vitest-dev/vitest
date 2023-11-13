---
title: Test Context | Guide
---

# Test Context

Inspired by [Playwright Fixtures](https://playwright.dev/docs/test-fixtures), Vitest's test context allows you to define utils, states, and fixtures that can be used in your tests.

## Usage

The first argument for each test callback is a test context.

```ts
import { it } from 'vitest'

it('should work', (ctx) => {
  // prints name of the test
  console.log(ctx.task.name)
})
```

## Built-in Test Context

#### `context.task`

A readonly object containing metadata about the test.

#### `context.expect`

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

#### `context.skip`

Skips subsequent test execution and marks test as skipped:

```ts
import { expect, it } from 'vitest'

it('math is hard', ({ skip }) => {
  skip()
  expect(2 + 2).toBe(5)
})
```

## Extend Test Context

Vitest provides two different ways to help you extend the test context.

### `test.extend`

::: warning
This API is available since Vitest 0.32.3.
:::

Like [Playwright](https://playwright.dev/docs/api/class-test#test-extend), you can use this method to define your own `test` API with custom fixtures and reuse it anywhere.

For example, we first create `myTest` with two fixtures, `todos` and `archive`.

```ts
// my-test.ts
import { test } from 'vitest'

const todos = []
const archive = []

export const myTest = test.extend({
  todos: async ({}, use) => {
    // setup the fixture before each test function
    todos.push(1, 2, 3)

    // use the fixture value
    await use(todos)

    // cleanup the fixture after each test function
    todos.length = 0
  },
  archive
})
```

Then we can import and use it.

```ts
import { expect } from 'vitest'
import { myTest } from './my-test.js'

myTest('add items to todos', ({ todos }) => {
  expect(todos.length).toBe(3)

  todos.push(4)
  expect(todos.length).toBe(4)
})

myTest('move items from todos to archive', ({ todos, archive }) => {
  expect(todos.length).toBe(3)
  expect(archive.length).toBe(0)

  archive.push(todos.pop())
  expect(todos.length).toBe(2)
  expect(archive.length).toBe(1)
})
```

We can also add more fixtures or override existing fixtures by extending `myTest`.

```ts
export const myTest2 = myTest.extend({
  settings: {
    // ...
  }
})
```

#### Fixture initialization

Vitest runner will smartly initialize your fixtures and inject them into the test context based on usage.

```ts
import { test } from 'vitest'

async function todosFn({ task }, use) {
  await use([1, 2, 3])
}

const myTest = test.extend({
  todos: todosFn,
  archive: []
})

// todosFn will not run
myTest('', () => {})
myTets('', ({ archive }) => {})

// todosFn will run
myTest('', ({ todos }) => {})
```

::: warning
When using `test.extend()` with fixtures, you should always use the object destructuring pattern `{ todos }` to access context both in fixture function and test function.
:::

#### TypeScript

To provide fixture types for all your custom contexts, you can pass the fixtures type as a generic.

```ts
interface MyFixtures {
  todos: number[]
  archive: number[]
}

const myTest = test.extend<MyFixtures>({
  todos: [],
  archive: []
})

myTest('', (context) => {
  expectTypeOf(context.todos).toEqualTypeOf<number[]>()
  expectTypeOf(context.archive).toEqualTypeOf<number[]>()
})
```

### `beforeEach` and `afterEach`

The contexts are different for each test. You can access and extend them within the `beforeEach` and `afterEach` hooks.

```ts
import { beforeEach, it } from 'vitest'

beforeEach(async (context) => {
  // extend context
  context.foo = 'bar'
})

it('should work', ({ foo }) => {
  console.log(foo) // 'bar'
})
```

#### TypeScript

To provide property types for all your custom contexts, you can aggregate the `TestContext` type by adding

```ts
declare module 'vitest' {
  export interface TestContext {
    foo?: string
  }
}
```

If you want to provide property types only for specific `beforeEach`, `afterEach`, `it` and `test` hooks, you can pass the type as a generic.

```ts
interface LocalTestContext {
  foo: string
}

beforeEach<LocalTestContext>(async (context) => {
  // typeof context is 'TestContext & LocalTestContext'
  context.foo = 'bar'
})

it<LocalTestContext>('should work', ({ foo }) => {
  // typeof foo is 'string'
  console.log(foo) // 'bar'
})
```
