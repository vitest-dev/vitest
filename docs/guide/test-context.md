---
title: Test Context | Guide
---

# Test Context

Inspired by [Playwright Fixtures](https://playwright.dev/docs/test-fixtures), Vitest's test context allows you to define utils, states, and fixtures that can be used in your tests.

## Usage

The first argument or each test callback is a test context.

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

The `expect` API which bound to the current test.

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

To provide type for your custom context properties, you can aggregate the type `TestContext` by adding

```ts
declare module 'vitest' {
  export interface TestContext {
    foo?: string
  }
}
```

