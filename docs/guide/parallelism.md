---
title: Parallelism | Guide
outline: deep
---

# Parallelism

## File Parallelism

By default, Vitest runs _test files_ in parallel. Depending on the specified `pool`, Vitest uses a different mechanism to parallelize test files:

- `forks` (the default) and `vmForks` run tests in different [child processes](https://nodejs.org/api/child_process.html)
- `threads` and `vmThreads` run tests in different [worker threads](https://nodejs.org/api/worker_threads.html)

Both "child processes" and "worker threads" are refered to as "workers". You can configure the number of running workers with [`minWorkers`](/config/#minworkers) and [`maxWorkers`](/config/#maxworkers) options. Or more granually with [`poolOptions`](/config/#pooloptions) configuration.

If you have a lot of tests, it is usually faster to run them in parallel, but it also depends on the project, the environment and [isolation](/config/#isolate) state. To disable file parallelisation, you can set [`fileParallelism`](/config/#fileparallelism) to `false`. To learn more about possible performance improvements, read the [Performance Guide](/guide/improving-performance).

## Test Parallelism

Unlike _test files_, Vitest runs _tests_ in sequence. This means that tests inside a single test file will run in the order they are defined.

Vitest supports the [`concurrent`](/api/#test-concurrent) option to run tests together. If this option is set, Vitest will group concurrent tests in the same _file_ (the number of simultaneously running tests depends on the [`maxConcurrency`](/config/#maxconcurrency) option) and run them with [`Promise.all`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/all).

Vitest doesn't perform any smart analysis and doesn't create additional workers to run these tests. This means that the performance of your tests will improve only if you rely heavily on asynchronous operations. For example, these tests will still run one after another even though the `concurrent` option is specified. This is because they are synchronous:

```ts
test.concurrent('the first test', () => {
  expect(1).toBe(1)
})

test.concurrent('the second test', () => {
  expect(2).toBe(2)
})
```

If you wish to run all tests concurrently, you can set the [`sequence.concurrent`](/config/#sequence-concurrent) option to `true`.
