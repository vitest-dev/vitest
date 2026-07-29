---
title: Type Narrowing in Tests | Recipes
---

# Type Narrowing in Tests

Tests deal with possibly-null values everywhere. `document.querySelector` returns `Element | null`, `Map.get(key)` returns `T | undefined`, and similar optional shapes show up throughout. The usual workarounds in test code are an unsafe cast with `as`, a non-null assertion with `!` on every access, or a runtime check like `expect(x).toBeTruthy()` that throws when the value is missing. All three add noise, and the runtime check is actively misleading because it doesn't narrow the type the way it looks like it should.

[`expect.assert`](/api/expect#assert) <Version>4.0.0</Version> throws at runtime and narrows the TypeScript type. The same call replaces all three.

## Pattern

```ts
import { expect, test } from 'vitest'

test('reads stored user', () => {
  const cache = new Map<string, { id: string; name: string }>()
  cache.set('alice', { id: '1', name: 'Alice' })

  const user = cache.get('alice') // typed as `{ id, name } | undefined`
  expect.assert(user) // throws if undefined, narrows below
  expect(user.name).toBe('Alice') // no `!`, no `as`, type is `{ id, name }`
})
```

The same shape collapses any "look up a value, check it exists, then use it" sequence:

```ts
const job = queue.find(j => j.id === 'build-42') // Job | undefined
expect.assert(job)
job.cancel() // narrowed to Job
```

## Why `toBeTruthy` doesn't narrow

`expect(x).toBeTruthy()` and `expect(x).toBeDefined()` throw at runtime when the value is missing, so the test fails the way you want. They don't narrow the type, though, because their TypeScript signature returns `void` rather than the special `asserts` form.

`expect.assert` is typed as an assertion function, so the same call serves both jobs.

## Narrowing beyond null

`expect.assert` accepts any boolean expression and applies the same narrowing TypeScript would do for an `if` branch. That covers `typeof` and `instanceof` checks:

```ts
expect.assert(typeof input === 'string')
input.toUpperCase() // input is `string`

expect.assert(error instanceof MyError)
expect(error.code).toBe('E_FOO') // error is `MyError`
```

For common shapes there are pre-built helpers from chai's [`assert` API](/api/assert), reachable via the same `expect.assert` namespace:

```ts
expect.assert.isDefined(maybeUser) // narrows away `undefined`
expect.assert.isString(input) // narrows to string
expect.assert.instanceOf(error, MyError) // narrows to MyError
```

## See also

- [`expect.assert`](/api/expect#assert)
- [Chai `assert` API](/api/assert)
- [Waiting for Async Conditions](/guide/recipes/wait-for)
