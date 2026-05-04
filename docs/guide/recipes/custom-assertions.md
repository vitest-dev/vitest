---
title: Custom Assertion Helpers | Recipes
---

# Custom Assertion Helpers

Reusable assertion helpers make tests easier to read, at the cost of stack traces. When an assertion fails inside a helper, the trace points at the line inside the helper rather than the test that called it. With the same helper used across many tests, the stack trace alone doesn't identify which call site failed.

[`vi.defineHelper`](/api/vi#vi-defineHelper) <Version>4.1.0</Version> wraps a function so Vitest strips its internals from the stack and points the error back at the call site instead.

## Pattern

```ts
import { expect, test, vi } from 'vitest'

const assertPair = vi.defineHelper((a: unknown, b: unknown) => {
  expect(a).toEqual(b) // ❌ failure does NOT point here
})

test('example', () => {
  assertPair('left', 'right') // ✅ failure points here
})
```

When `assertPair` fails, the diff and stack frame surface the test line that called it. That's the same behaviour built-in matchers give you.

## Composing multiple expectations

The same wrapper works for helpers that bundle several assertions:

```ts
import { expect, test, vi } from 'vitest'

const expectValidUser = vi.defineHelper((user: unknown) => {
  expect(user).toHaveProperty('id')
  expect(user).toHaveProperty('email')
  expect(user.email).toMatch(/@/)
})

test('returns a valid user', async () => {
  const user = await fetchUser('alice')
  expectValidUser(user)
})
```

A failure in any of the inner `expect` calls is reported against the `expectValidUser(user)` line in the test.

Reach for `defineHelper` whenever a reusable check calls `expect` more than once, whether that's a domain-specific helper like `expectValidJWT` or any block of `expect` calls you'd otherwise inline into every test.

For asymmetric matchers and custom matchers attached to `expect.extend`, see [Extending Matchers](/guide/extending-matchers).

## See also

- [`vi.defineHelper`](/api/vi#vi-defineHelper)
- [Extending Matchers](/guide/extending-matchers)
