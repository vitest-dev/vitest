---
title: Testing Asynchronous Code | Guide
prev:
  text: Using Matchers
  link: /guide/learn/matchers
next:
  text: Setup and Teardown
  link: /guide/learn/setup-teardown
---

# Testing Asynchronous Code

JavaScript code frequently runs asynchronously. Whether you're fetching data, reading files, or waiting on timers, Vitest needs to know when the code it is testing has completed before moving on to the next test. Here are the patterns you'll use most often.

## Async/Await

The most straightforward approach is to make your test function `async`. Vitest will automatically wait for the returned promise to resolve before considering the test complete. If the promise rejects, the test fails with the rejection reason.

```js
import { expect, test } from 'vitest'

function fetchUser(id) {
  return Promise.resolve({ id, name: 'Alice' })
}

test('fetches user by id', async () => {
  const user = await fetchUser(1)
  expect(user.name).toBe('Alice')
})
```

This is the pattern you'll use the vast majority of the time. It reads just like synchronous code, and errors propagate naturally through `await`.

## Resolves and Rejects

Sometimes you'd rather assert on a promise directly instead of `await`-ing it into a variable first. The [`.resolves`](/api/expect#resolves) and [`.rejects`](/api/expect#rejects) helpers let you do this. They unwrap the promise and then apply the matcher to the resolved or rejected value:

```js
test('resolves to Alice', async () => {
  await expect(fetchUser(1)).resolves.toMatchObject({ name: 'Alice' })
})

test('rejects with an error', async () => {
  await expect(fetchInvalidUser()).rejects.toThrow('User not found')
})
```

::: warning
Don't forget the `await` before `expect`. Vitest will detect unawaited assertions and print a warning at the end of the test, but it's best to always include `await` explicitly. Vitest will also wait for all pending promises in `Promise.all` before starting the next test, but relying on this behavior makes tests harder to understand.
:::

## Callbacks

Some older APIs use callbacks instead of promises. Since Vitest works with promises, the simplest approach is to wrap the callback in a `Promise`:

```js
function fetchData(callback) {
  setTimeout(() => callback('peanut butter'), 100)
}

test('the data is peanut butter', async () => {
  const data = await new Promise((resolve) => {
    fetchData(resolve)
  })
  expect(data).toBe('peanut butter')
})
```

This pattern works for any callback-based API. Pass `resolve` as the success callback, and the test will wait until the callback is invoked.

::: tip
Most modern Node.js APIs (such as `fs/promises` and `fetch`) support promises natively, so you can use `async`/`await` directly. The callback wrapping pattern above is mainly useful for older libraries that haven't adopted promises yet.
:::

## Timeouts

By default, each test has a 5-second timeout. If a test takes longer than that (perhaps because a promise never resolves, or a network request hangs), it will fail with a timeout error. This prevents your test suite from getting stuck indefinitely.

You can set a [custom timeout](/api/test#timeout) as the third argument to `test`, which is useful for tests that legitimately need more time:

```js
test('long-running operation', async () => {
  await someSlowOperation()
}, 10_000) // 10 seconds
```

If you find yourself needing longer timeouts across many tests, you can change the default for all tests with the [`testTimeout`](/config/testtimeout) config option:

```js [vitest.config.js]
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    testTimeout: 10_000,
  },
})
```

## Concurrent Tests

By default, tests within a file run one after another. This is usually what you want, especially when tests share setup code. But if you have many independent async tests that each spend most of their time waiting (on network, disk, timers, etc.), running them concurrently with [`test.concurrent`](/api/test#concurrent) can significantly speed things up:

```js
test.concurrent('first async test', async () => {
  const result = await fetchUser(1)
  expect(result.name).toBe('Alice')
})

test.concurrent('second async test', async () => {
  const result = await fetchUser(2)
  expect(result.name).toBe('Bob')
})
```

See the [Parallelism](/guide/parallelism) guide for the full picture of how Vitest runs tests in parallel, both across files and within them.

## Unhandled Rejections

By default, Vitest reports unhandled promise rejections as errors in the test run. If a promise rejects somewhere in your code and nothing catches it, the test run will fail, even if all your assertions passed. This is intentional: unhandled rejections usually indicate real bugs, like a forgotten `await` or a fire-and-forget promise that silently fails.

```js
test('this causes an unhandled rejection error', () => {
  // This promise rejects but is never awaited or caught
  Promise.reject(new Error('oops'))
})
```

To fix this, make sure you `await` all promises or catch expected rejections:

```js
test('handle the rejection', async () => {
  // Either await the promise
  await expect(Promise.reject(new Error('oops'))).rejects.toThrow('oops')

  // Or catch it explicitly if you don't need to assert on it
  Promise.reject(new Error('expected')).catch(() => {})
})
```

If your code intentionally produces unhandled rejections, you can filter specific errors with [`onUnhandledError`](/config/onunhandlederror) or disable the check entirely with [`dangerouslyIgnoreUnhandledErrors`](/config/dangerouslyignoreunhandlederrors).
