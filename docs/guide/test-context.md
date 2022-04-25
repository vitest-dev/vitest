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

## Built-in Text Context

#### `context.meta`

A readonly object containing metadata about the test.

#### `context.expect`

The `expect` API which bound to the current test.

## Extend Test Context

The context are different for each test. You can access and extend them with in `beforeEach` and `afterEach` hook.

```ts
import { it } from 'vitest'

beforeEach(async (context) => {
  // extend context
  context.foo = 'bar'
})

it('should work', ({ foo }) => {
  console.log(foo) // 'bar'
})
```
