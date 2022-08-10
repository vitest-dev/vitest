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
  console.log(ctx.meta.name)
})
```

## Built-in Test Context

#### `context.meta`

A readonly object containing metadata about the test.

#### `context.expect`

The `expect` API bound to the current test.

## Extend Test Context

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

### TypeScript

To provide property types for all your custom contexts, you can aggregate the `TestContext` type by adding

```ts
declare module 'vitest' {
  export interface TestContext {
    foo?: string
  }
}
```

Since Vitest v0.21.1, if you want to provide property types only for specific `beforeEach`, `afterEach`, `it` and `test` hooks, you can provide an extra context type as type parameter.

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