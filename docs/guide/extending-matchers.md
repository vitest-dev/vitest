---
title: Extending Matchers | Guide
---

# Extending Matchers

Since Vitest is compatible with both Chai and Jest, you can use either the `chai.use` API or `expect.extend`, whichever you prefer.

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

If you are using TypeScript, you can extend default `Assertion` interface in an ambient declaration file (e.g: `vitest.d.ts`) with the code below:

```ts
import 'vitest'

interface CustomMatchers<R = unknown> {
  toBeFoo: () => R
}

declare module 'vitest' {
  interface Assertion<T = any> extends CustomMatchers<T> {}
  interface AsymmetricMatchersContaining extends CustomMatchers {}
}
```

::: warning
Don't forget to include the ambient declaration file in your `tsconfig.json`.
:::

The return value of a matcher should be compatible with the following interface:

```ts
interface ExpectationResult {
  pass: boolean
  message: () => string
  // If you pass these, they will automatically appear inside a diff when
  // the matcher does not pass, so you don't need to print the diff yourself
  actual?: unknown
  expected?: unknown
}
```

::: warning
If you create an asynchronous matcher, don't forget to `await` the result (`await expect('foo').toBeFoo()`) in the test itself.
:::

The first argument inside a matcher's function is the received value (the one inside `expect(received)`). The rest are arguments passed directly to the matcher.

Matcher function have access to `this` context with the following properties:

- `isNot`

  Returns true, if matcher was called on `not` (`expect(received).not.toBeFoo()`).

- `promise`

  If matcher was called on `resolved/rejected`, this value will contain the name of modifier. Otherwise, it will be an empty string.

- `equals`

  This is a utility function that allows you to compare two values. It will return `true` if values are equal, `false` otherwise. This function is used internally for almost every matcher. It supports objects with asymmetric matchers by default.

- `utils`

  This contains a set of utility functions that you can use to display messages.

`this` context also contains information about the current test. You can also get it by calling `expect.getState()`. The most useful properties are:

- `currentTestName`

  Full name of the current test (including describe block).

- `testPath`

  Path to the current test.
