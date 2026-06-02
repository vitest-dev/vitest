---
title: Parallelism | Guide
outline: deep
---

# Parallelism

Vitest has two levels of parallelism: it can run multiple *test files* at the same time, and within each file it can run multiple *tests* at the same time. Understanding the difference between the two is important because they work differently and have different trade-offs.

## File Parallelism

By default, Vitest runs test files in parallel across multiple workers. Each file gets its own isolated environment, so tests in different files can't interfere with each other.

The mechanism Vitest uses to create workers depends on the configured [`pool`](/config/pool):

- `forks` (the default) and `vmForks` run each file in a separate [child process](https://nodejs.org/api/child_process.html)
- `threads` and `vmThreads` run each file in a separate [worker thread](https://nodejs.org/api/worker_threads.html)

You can control how many workers run simultaneously with the [`maxWorkers`](/config/maxworkers) option. More workers means more files run in parallel, but also more memory and CPU usage. The right number depends on your machine and how heavy your tests are.

For most projects, file parallelism is the single biggest factor in test suite speed. However, there are cases where you might want to disable it — for example, if your tests share an external resource like a database that can't handle concurrent access. You can set [`fileParallelism`](/config/fileparallelism) to `false` to run files one at a time.

To learn more about tuning performance, see the [Performance Guide](/guide/improving-performance).

## Test Parallelism

Within a single file, Vitest runs tests sequentially by default. Tests execute in the order they are defined, one after another. This is the safest default because tests within a file often share setup and state through lifecycle hooks like `beforeEach`.

If the tests in a file are independent, you can opt into running them concurrently with the [`concurrent`](/api/test#test-concurrent) modifier:

```ts
import { expect, test } from 'vitest'

test.concurrent('fetches user profile', async () => {
  const user = await fetchUser(1)
  expect(user.name).toBe('Alice')
})

test.concurrent('fetches user posts', async () => {
  const posts = await fetchPosts(1)
  expect(posts).toHaveLength(3)
})
```

When tests are marked as `concurrent`, Vitest groups them together and runs them with [`Promise.all`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/all). The number of tests running at once is bounded by the [`maxConcurrency`](/config/maxconcurrency) option.

::: tip When does `concurrent` actually help?
Vitest doesn't create extra workers for concurrent tests — they all run in the same worker as the file they belong to. This means `concurrent` only speeds things up when your tests spend time *waiting* (on network requests, timers, file I/O, etc.). Purely synchronous tests won't benefit because they still block the single JavaScript thread:

```ts
// These run one after another despite `concurrent`,
// because there is nothing to await
test.concurrent('the first test', () => {
  expect(1).toBe(1)
})

test.concurrent('the second test', () => {
  expect(2).toBe(2)
})
```
:::

You can also apply `concurrent` to an entire suite:

```ts
import { describe, expect, test } from 'vitest'

describe.concurrent('user API', () => {
  test('fetches profile', async () => {
    const user = await fetchUser(1)
    expect(user.name).toBe('Alice')
  })

  test('fetches posts', async () => {
    const posts = await fetchPosts(1)
    expect(posts).toHaveLength(3)
  })
})
```

If you want *all* tests in your project to run concurrently by default, set [`sequence.concurrent`](/config/sequence#sequence-concurrent) to `true` in your config.

You can opt individual tests or suites out of inherited concurrency with `concurrent: false`:

```ts
test('uses a shared resource', { concurrent: false }, async () => {
  // ...
})

describe('shared resource suite', { concurrent: false }, () => {
  test('step 1', async () => { /* ... */ })
  test('step 2', async () => { /* ... */ })
})
```

### Hooks with Concurrent Tests

When tests run concurrently, lifecycle hooks behave differently. `beforeAll` and `afterAll` still run once for the group, but `beforeEach` and `afterEach` run for each test — potentially at the same time, since the tests themselves overlap.

The hook execution order is controlled by [`sequence.hooks`](/config/sequence#sequence-hooks). With `sequence.hooks: 'parallel'`, hooks are also bounded by the [`maxConcurrency`](/config/maxconcurrency) limit.
