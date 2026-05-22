---
title: Conditional Mocking with vi.when | Recipes
---

# Conditional Mocking with `vi.when`

<Version>5.0.0</Version>

::: tip Prerequisites
This recipe assumes you already have some familiarity with [mocking](/guide/mocking) in Vitest.
:::

When a mock needs to return different values depending on the arguments it receives, [`mockReturnValue`](/api/mock#mockreturnvalue) doesn't help because it always returns the same value. The standard approach would be to use [`mockImplementation`](/api/mock#mockimplementation) with a `switch` or a series of `if/else` statements:

```ts
db.findById.mockImplementation((id) => {
  if (id === 1) {
    return Promise.resolve({ id: 1, name: 'Ella' })
  }

  if (id === 2) {
    return Promise.resolve({ id: 2, name: 'Gracie' })
  }

  return Promise.resolve(undefined)
})
```

This works, but it becomes tedious because you have to write the argument-matching logic yourself. This is something that Vitest can handle for you when using the [`vi.when`](/api/vi#vi-when) API.

## Pattern

`vi.when` takes a spy and lets you define argument-specific behaviors.

Call `.calledWith(...args)` to declare which arguments to match. This creates a _behavior_.

Then attach an _action_ by calling a `then*` method. The action determines what happens when the behavior matches.

Multiple behaviors can be chained on the same spy:

```ts
test('returns user data', async () => {
  const db = { findById: vi.fn<FindById>() }

  vi.when(db.findById)
    .calledWith(1)
    .thenResolve({ id: 1, name: 'Ella' })
    .calledWith(2)
    .thenResolve({ id: 2, name: 'Gracie' })

  await expect(getUserById(db, 1)).resolves.toEqual({ name: 'Ella' })
  await expect(getUserById(db, 2)).resolves.toEqual({ name: 'Gracie' })
})
```

The same approach works across all mock outcome types. Here is the full set of actions and their equivalents:

| Action | Returns | Equivalent to |
|---|---|---|
| `thenReturn(value)` | `value` | `mockReturnValue(value)` |
| `thenThrow(error)` | `throw error` | `mockThrow(error)` |
| `thenResolve(value)` | `Promise.resolve(value)` | `mockResolvedValue(value)` |
| `thenReject(error)` | `Promise.reject(error)` | `mockRejectedValue(error)` |

## Stacking actions

A single behavior can have multiple actions attached to it. When the behavior matches, actions are _consumed_ in **last-in-first-out** order: the most recently registered action runs first. Once that action has been consumed, Vitest falls back to the previous one. Use the `times` option to limit how many calls an action handles before falling through to the next action. An action with no `times` limit runs indefinitely.

Because actions are evaluated in reverse registration order, indefinite actions should be registered first so that later finite actions can temporarily override them.

```ts
import { readConfig } from './config.ts'

test('retries after an initial failure', async () => {
  const fetchInstance = vi.fn<() => Promise<unknown>>()

  vi.when(fetchInstance)
    .calledWith('/data/config.json')
    .thenResolve(new Response('{ debug: true }'))
    // ↳ indefinite fallback
    .thenReject(new Error('network error'), { times: 1 })
    // ↳ applied first and consumed after one call

  await expect(readConfig(fetchInstance)).resolves.toEqual({ debug: true })

  expect(fetchInstance).toHaveBeenCalledTimes(2)
})
```

For convenience, `then*Once` shorthands are available as sugar for `{ times: 1 }`: `thenReturnOnce`, `thenResolveOnce`, `thenThrowOnce`, `thenRejectOnce`.

## Asymmetric matchers

`calledWith` supports [asymmetric matchers](/guide/learn/matchers#asymmetric-matchers). This is useful when you care about the shape or type of an argument rather than its exact value:

```ts
test('sends email to each recipient', () => {
  vi.when(sendEmail)
    .calledWith(expect.stringContaining('@'))
    .thenReturn({ ok: true, message: 'sent via external relay' })
})
```

Behaviors, unlike actions, are matched in **first-in-first-out** order. The first behavior whose arguments match the call wins, just like a chain of `if/else` statements. Specific matchers must therefore be registered before broad ones.

```ts
test('sends email to each recipient', () => {
  vi.when(sendEmail)
    .calledWith(expect.stringContaining('@internal.example.com'))
    .thenReturn({ ok: true, message: 'sent via internal relay' })
    .calledWith(expect.stringContaining('@'))
    .thenReturn({ ok: true, message: 'sent via external relay' })
})
```

::: warning Behavior Merging
When registering a new behavior, Vitest checks existing behaviors in registration order. If the new arguments already match an existing behavior, the new action is merged into that behavior instead of creating a new one.

This is especially important with broad asymmetric matchers:

```ts
vi.when(getRole)
  .calledWith(expect.any(String))
  .thenReturn('user')
  .calledWith('admin@example.com')
  .thenReturnOnce('admin')
```

Because the second registration is merged into the existing behavior, the `'admin'` action is not scoped to `'admin@example.com'`. Instead, it becomes the next action for the entire `expect.any(String)` behavior. The resulting behavior acts as if it had been written like this:

```ts
vi.when(getRole)
  .calledWith(expect.any(String))
  .thenReturn('user')
  .thenReturnOnce('admin')
```

As a result, the first call with any string returns `'admin'`, while later calls return `'user'`:

```ts
expect(getRole('user@example.com')).toBe('admin')
expect(getRole('user@example.com')).toBe('user')
```
:::

## Handling unmatched calls

By default, when the spy is called with arguments that match no registered behavior, it falls back to the spy's original implementation. Since `db.findById` above has no original implementation, `db.findById(3)` returns `undefined`.

There are three ways to change this.

### `onUnmatched: 'throw'`

Pass `{ onUnmatched: 'throw' }` to throw whenever the spy is called with unregistered arguments:

```ts
vi.when(db.findById, { onUnmatched: 'throw' })
  .calledWith(1)
  .thenResolve({ id: 1, name: 'Ella' })

await expect(db.findById(1)).resolves.toMatchObject({ name: 'Ella' })
await expect(db.findById(3)).rejects.toThrow(
  'vi.when: no behavior defined when called with [3]',
)
```

The error message includes the unmatched arguments. The error type and message are fixed and cannot be customized.

### `onUnmatched: fn`

Pass a function to handle unmatched calls with custom logic. This is useful when you set up the mock once but want a different fallback in each test:

```ts
const db = { findById: vi.fn<FindById>() }

test('returns a placeholder for unknown ids', async () => {
  vi.when(
    db.findById,
    { onUnmatched: id => Promise.resolve({ id, name: `User ${id}` }) }
  )
    .calledWith(1)
    .thenResolve({ id: 1, name: 'Ella' })

  await expect(db.findById(1)).resolves.toMatchObject({ name: 'Ella' })
  await expect(db.findById(42)).resolves.toMatchObject({ name: 'User 42' })
})
```

The function is called with the same arguments as the spy and its return value is used directly as the spy's result. If it throws or returns a rejected promise, that error propagates to the caller just as it would from any action.

### Asymmetric matcher as catch-all

Building on the [previous section](#asymmetric-matchers): registering a broad `calledWith` as the last entry naturally acts as a fallback for everything that doesn't match the earlier, more specific behaviors:

```ts
vi.when(db.findById)
  .calledWith(1)
  .thenResolve({ id: 1, name: 'Ella' })
  .calledWith(2)
  .thenResolve({ id: 2, name: 'Gracie' })
  .calledWith(expect.any(Number))
  .thenReject(new Error('user not found'))
```

Unlike `onUnmatched: 'throw'`, this approach gives you more flexibility for the fallback: you can return a specific value, resolve or reject a promise, or throw a typed error.

## Asserting that all behaviors were called

To check that all registered behaviors were actually matched and their actions consumed, the object returned by `vi.when` supports the [`toHaveBeenExhausted`](/api/expect#tohavebeenexhausted) assertion:

```ts
test('loads both users', async () => {
  const db = { findById: vi.fn<FindById>() }

  const w = vi.when(db.findById)
    .calledWith(1)
    .thenResolveOnce({ id: 1, name: 'Ella' })
    .calledWith(2)
    .thenResolveOnce({ id: 2, name: 'Gracie' })

  await loadDashboard(db)

  expect(w).toHaveBeenExhausted()
})
```

In this example, if `loadDashboard` only calls `findById(1)`, the test fails with a message listing the behaviors that were never matched:

```
AssertionError: expected all behaviors to have been exhausted, but some remain:

  calledWith(2)
    ✗ thenReturn({ id: 2, name: 'Gracie' })  never called
```

::: warning Caveat
A `vi.when` chain with no behaviors or a behavior with no actions (a bare `.calledWith()` with no `then*` call) is never considered exhausted and will always cause `toHaveBeenExhausted` to fail.

Indefinite actions (no `times` limit) satisfy exhaustion checks after being used at least once. The actions keep responding after that, but the assertion is satisfied.
:::

## Automatic cleanup with `using`

`vi.when` supports the [Explicit Resource Management](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Resource_management) protocol. Declaring the chain with `using` scopes the mock behaviors to the current block: when execution leaves the block, the spy's original implementation is automatically restored.

```ts
const spy = vi.fn(() => 'original')

test('with mocked behavior', () => {
  using w = vi.when(spy).calledWith('hello').thenReturn('mocked')
  expect(spy('hello')).toBe('mocked')
}) // ← restored here

test('without mocked behavior', () => {
  expect(spy('hello')).toBe('original')
})
```

This is particularly handy when you need to override a shared spy for just one branch of a test without manually calling cleanup code afterwards.

## See also

- [`vi.when`](/api/vi#vi-when)
- [`toHaveBeenExhausted`](/api/expect#tohavebeenexhausted)
- [`vi.isWhenChain`](/api/vi#vi-iswhenchain)
- [Auto-Cleanup with `using`](/guide/recipes/explicit-resources)
