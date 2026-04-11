---
title: Using Matchers | Guide
prev:
  text: Writing Tests
  link: /guide/learn/writing-tests
next:
  text: Testing Asynchronous Code
  link: /guide/learn/async
---

# Using Matchers

Vitest uses `expect` with "matchers" to assert that values meet certain conditions. This page covers the matchers you'll use most often. For the complete list, see the [Expect API Reference](/api/expect).

## Common Matchers

The simplest way to test a value is with exact equality. When you write `expect(2 + 2).toBe(4)`, the [`toBe`](/api/expect#tobe) matcher checks that the value is exactly `4` using [`Object.is`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/is).

```js
import { expect, test } from 'vitest'

test('two plus two is four', () => {
  expect(2 + 2).toBe(4)
})
```

This works great for primitive values like numbers, strings, and booleans. But when you're comparing objects, `toBe` checks *identity* (whether they're the exact same object in memory), not whether they have the same shape. That's where [`toEqual`](/api/expect#toequal) comes in. It recursively compares every field of an object or element of an array, ignoring object identity:

```js
test('object assignment', () => {
  const data = { one: 1 }
  data.two = 2

  expect(data).toEqual({ one: 1, two: 2 })
})
```

Here's an example that shows the difference more clearly. Two objects with the same content are `toEqual` but not `toBe`:

```js
test('toBe vs toEqual', () => {
  const a = { name: 'Alice' }
  const b = { name: 'Alice' }

  // These are different objects in memory
  expect(a).not.toBe(b)

  // But they have the same structure
  expect(a).toEqual(b)
})
```

::: tip
A good rule of thumb: use `toBe` for primitives (numbers, strings, booleans) and `toEqual` for objects and arrays.
:::

You can also negate any matcher by inserting `.not` before it. This is useful when you want to verify that something is *not* the case:

```js
test('adding positive numbers is not zero', () => {
  expect(1 + 2).not.toBe(0)
})
```

## Truthiness

In tests you sometimes need to distinguish between `undefined`, `null`, and `false`. Other times you don't care about the exact value and just want to know if something is truthy or falsy. Vitest provides matchers for both situations:

- [`toBeNull`](/api/expect#tobenull) matches only `null`
- [`toBeUndefined`](/api/expect#tobeundefined) matches only `undefined`
- [`toBeDefined`](/api/expect#tobedefined) is the opposite of `toBeUndefined`. It passes for anything that isn't `undefined`
- [`toBeTruthy`](/api/expect#tobetruthy) matches anything that an `if` statement would treat as true
- [`toBeFalsy`](/api/expect#tobefalsy) matches anything that an `if` statement would treat as false

You should pick the matcher that most precisely describes what you're checking. Using `toBeTruthy` when you really mean `toBeDefined` can hide bugs, because `0` and `""` are both defined but falsy.

```js
test('null checks', () => {
  const n = null

  expect(n).toBeNull()
  expect(n).toBeDefined()
  expect(n).toBeFalsy()
  expect(n).not.toBeTruthy()
  expect(n).not.toBeUndefined()
})

test('zero', () => {
  const z = 0

  expect(z).toBeDefined() // passes: 0 is defined
  expect(z).toBeFalsy() // passes: 0 is falsy
  expect(z).not.toBeNull() // passes: 0 is not null
})
```

## Numbers

Most number comparisons are straightforward. Vitest provides the matchers you'd expect for greater-than, less-than, and equality checks:

```js
test('number comparisons', () => {
  const value = 2 + 2

  expect(value).toBeGreaterThan(3)
  expect(value).toBeGreaterThanOrEqual(3.5)
  expect(value).toBeLessThan(5)
  expect(value).toBeLessThanOrEqual(4.5)

  // For exact equality, both toBe and toEqual work the same for numbers
  expect(value).toBe(4)
  expect(value).toEqual(4)
})
```

There is one common gotcha with floating point arithmetic. In JavaScript, `0.1 + 0.2` doesn't equal `0.3` exactly (it's `0.30000000000000004`). This means a `toBe(0.3)` check will fail. Use [`toBeCloseTo`](/api/expect#tobecloseto) instead, which compares numbers within a small rounding error:

```js
test('adding floating point numbers', () => {
  const value = 0.1 + 0.2

  // This won't work because of floating point rounding
  // expect(value).toBe(0.3)

  // This works
  expect(value).toBeCloseTo(0.3)
})
```

## Strings

You can test strings against regular expressions with [`toMatch`](/api/expect#tomatch). This is especially handy when you care about a pattern rather than an exact value, like checking that an error message contains a certain word or that a URL matches a particular format:

```js
test('there is no I in team', () => {
  expect('team').not.toMatch(/I/)
})

test('version string matches semver format', () => {
  expect('vitest@1.0.0').toMatch(/vitest@\d+\.\d+\.\d+/)
})
```

## Arrays and Iterables

[`toContain`](/api/expect#tocontain) checks that an array (or any iterable, like a `Set`) includes a particular item. It uses `===` for comparison, so it works well for primitives:

```js
test('the shopping list has milk in it', () => {
  const shoppingList = ['milk', 'bread', 'eggs', 'butter']

  expect(shoppingList).toContain('milk')
  expect(new Set(shoppingList)).toContain('milk')
})
```

If you need to check that an array contains an object with a particular structure, use [`toContainEqual`](/api/expect#tocontainequal) instead. It works like `toEqual` but for individual items inside an array.

## Objects

When testing objects, you often want to check only a few important fields without specifying every property. [`toMatchObject`](/api/expect#tomatchobject) lets you do exactly that. It verifies that the object contains at least the properties you specify, and ignores any additional ones:

```js
test('user has expected fields', () => {
  const user = {
    id: 1,
    name: 'Alice',
    email: 'alice@example.com',
    createdAt: '2024-01-01'
  }

  // We only care about name and email here
  expect(user).toMatchObject({
    name: 'Alice',
    email: 'alice@example.com',
  })
})
```

For checking individual properties, especially nested ones, [`toHaveProperty`](/api/expect#tohaveproperty) is more readable. You pass a dot-separated path and optionally an expected value:

```js
test('object has property', () => {
  const user = {
    name: 'Alice',
    address: { city: 'Paris', zip: '75001' }
  }

  expect(user).toHaveProperty('name')
  expect(user).toHaveProperty('name', 'Alice')
  expect(user).toHaveProperty('address.city', 'Paris')
  expect(user).toHaveProperty('address.zip')
})
```

## Exceptions

To verify that a function throws an error, use [`toThrow`](/api/expect#tothrow). You need to wrap the call in another function so that Vitest can catch the error instead of letting it crash the test:

```js
function compileCode(code) {
  if (code === '') {
    throw new Error('Cannot compile empty string')
  }
  return code
}

test('compiling an empty string throws', () => {
  // Check that it throws at all
  expect(() => compileCode('')).toThrow()

  // Check the error message
  expect(() => compileCode('')).toThrow('Cannot compile empty string')

  // Check the message with a regex
  expect(() => compileCode('')).toThrow(/empty string/)
})
```

::: tip
The wrapping function `() => compileCode('')` is important. If you wrote `expect(compileCode('')).toThrow()`, the error would be thrown *before* `expect` gets a chance to catch it, and the test would fail with an unhandled error instead.
:::

## Soft Assertions

Normally, a failing assertion stops the test immediately. That's useful most of the time, but sometimes you want to check several independent things and see all the failures at once rather than fixing them one by one.

[`expect.soft`](/api/expect#soft) does exactly that. It records the failure but lets the test keep running:

```js
test('check multiple fields', () => {
  const user = { name: 'Alice', age: 30, role: 'admin' }

  expect.soft(user.name).toBe('Alice')
  expect.soft(user.age).toBe(25) // this fails but execution continues
  expect.soft(user.role).toBe('admin')
  // the test report will show that age didn't match
})
```

This is especially useful for validating the shape of an API response or a complex object where multiple fields might be wrong at the same time.
