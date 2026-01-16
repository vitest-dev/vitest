---
title: Extending Matchers | Guide
---

# Extending Matchers

Since Vitest is compatible with both Chai and Jest, you can use either the [`chai.use`](https://www.chaijs.com/guide/plugins/) API or `expect.extend`, whichever you prefer.

This guide will explore extending matchers with `expect.extend`. If you are interested in Chai's API, check [their guide](https://www.chaijs.com/guide/plugins/).

To extend default matchers, call `expect.extend` with an object containing your matchers.

```ts
expect.extend({
  toBeFoo(received, expected) {
    const { isNot } = this
    return {
      // do not alter your "pass" based on isNot. Vitest does it for you
      pass: received === 'foo',
      message: () => `${received} is${isNot ? ' not' : ''} foo`
    }
  }
})
```

If you are using TypeScript, you can extend default `Matchers` interface in an ambient declaration file (e.g: `vitest.d.ts`) with the code below:

```ts
import 'vitest'

declare module 'vitest' {
  interface Matchers<T = any> {
    toBeFoo: () => R
  }
}
```

::: tip
Importing `vitest` makes TypeScript think this is an ES module file, type declaration won't work without it.
:::

Extending the `Matchers` interface will add a type to `expect.extend`, `expect().*`, and `expect.*` methods at the same time.

::: warning
Don't forget to include the ambient declaration file in your `tsconfig.json`.
:::

The return value of a matcher should be compatible with the following interface:

```ts
interface MatcherResult {
  pass: boolean
  message: () => string
  // If you pass these, they will automatically appear inside a diff when
  // the matcher does not pass, so you don't need to print the diff yourself
  actual?: unknown
  expected?: unknown
}
```

::: warning
If you create an asynchronous matcher, don't forget to `await` the result (`await expect('foo').toBeFoo()`) in the test itself:

```ts
expect.extend({
  async toBeAsyncAssertion() {
    // ...
  }
})

await expect().toBeAsyncAssertion()
```
:::

The first argument inside a matcher's function is the received value (the one inside `expect(received)`). The rest are arguments passed directly to the matcher. Since version 4.1, Vitest exposes several types that can be used by your custom matcher:

```ts
import type {
  // the function type
  Matcher,
  // the return value
  MatcherResult,
  // state available as `this`
  MatcherState,
} from 'vitest'
import { expect } from 'vitest'

// a simple matcher, using "function" to have access to "this"
const customMatcher: Matcher = function (received) {
  // ...
}

// a matcher with arguments
const customMatcher: Matcher<MatcherState, [arg1: unknown, arg2: unknown]> = function (received, arg1, arg2) {
  // ...
}

// a matcher with custom annotations
function customMatcher(this: MatcherState, received: unknown, arg1: unknown, arg2: unknown): MatcherResult {
  // ...
  return {
    pass: false,
    message: () => 'something went wrong!',
  }
}

expect.extend({ customMatcher })
```

Matcher function has access to `this` context with the following properties:

### `isNot`

Returns true, if matcher was called on `not` (`expect(received).not.toBeFoo()`). You do not need to respect it, Vitest will reverse the value of `pass` automatically.

### `promise`

If matcher was called on `resolved/rejected`, this value will contain the name of modifier. Otherwise, it will be an empty string.

### `equals`

This is a utility function that allows you to compare two values. It will return `true` if values are equal, `false` otherwise. This function is used internally for almost every matcher. It supports objects with asymmetric matchers by default.

### `utils`

This contains a set of utility functions that you can use to display messages.

`this` context also contains information about the current test. You can also get it by calling `expect.getState()`. The most useful properties are:

### `currentTestName`

Full name of the current test (including describe block).

### `task` <Advanced /> <Version>4.1.0</Version> {#task}

Contains a reference to [the `Test` runner task](/api/advanced/runner#tasks) when available.

::: warning
When using the global `expect` with concurrent tests, `this.task` is `undefined`. Use `context.expect` instead to ensure `task` is available in custom matchers.
:::

### `testPath`

File path to the current test.

### `environment`

The name of the current [`environment`](/config/environment) (for example, `jsdom`).

### `soft`

Was assertion called as a [`soft`](/api/expect#soft) one. You don't need to respect it, Vitest will always catch the error.

::: tip
These are not all of the available properties, only the most useful ones. The other state values are used by Vitest internally.
:::
