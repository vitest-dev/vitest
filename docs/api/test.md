---
outline: deep
---

# Test

- **Alias:** `it`

```ts
function test(
  name: string | Function,
  body?: () => unknown,
  timeout?: number
): void
function test(
  name: string | Function,
  options: TestOptions,
  body?: () => unknown,
): void
```

`test` or `it` defines a set of related expectations. It receives the test name and a function that holds the expectations to test.

Optionally, you can provide a timeout (in milliseconds) for specifying how long to wait before terminating, or a set of [additional options](#test-options). The default timeout is 5 seconds, and can be configured globally with [`testTimeout`](/config/testtimeout).

```ts
import { expect, test } from 'vitest'

test('should work as expected', () => {
  expect(Math.sqrt(4)).toBe(2)
})
```

::: warning
If the first argument is a function, its `name` property will be used as the name of the test. The function itself will not be called.

If test body is not provided, the test is marked as `todo`.
:::

When a test function returns a promise, the runner will wait until it is resolved to collect async expectations. If the promise is rejected, the test will fail.

::: tip
In Jest, `TestFunction` can also be of type `(done: DoneCallback) => void`. If this form is used, the test will not be concluded until `done` is called. You can achieve the same using an `async` function, see the [Migration guide Done Callback section](/guide/migration#done-callback).
:::

## Test Options

You can define boolean options by chaining properties on a function:

```ts
import { test } from 'vitest'

test.skip('skipped test', () => {
  // some logic that fails right now
})

test.concurrent.skip('skipped concurrent test', () => {
  // some logic that fails right now
})
```

But you can also provide an object as a second argument instead:

```ts
import { test } from 'vitest'

test('skipped test', { skip: true }, () => {
  // some logic that fails right now
})

test('skipped concurrent test', { skip: true, concurrent: true }, () => {
  // some logic that fails right now
})
```

They both work in exactly the same way. To use either one is purely a stylistic choice.

### timeout

- **Type:** `number`
- **Default:** `5_000` (configured by [`testTimeout`](/config/testtimeout))

Test timeout in milliseconds.

::: warning
Note that if you are providing timeout as the last argument, you cannot use options anymore:

```ts
import { test } from 'vitest'

// ✅ this works
test.skip('heavy test', () => {
  // ...
}, 10_000)

// ❌ this doesn't work
test('heavy test', { skip: true }, () => {
  // ...
}, 10_000)
```

However, you can provide a timeout inside the object:

```ts
import { test } from 'vitest'

// ✅ this works
test('heavy test', { skip: true, timeout: 10_000 }, () => {
  // ...
})
```
:::

### retry

- **Default:** `0` (configured by [`retry`](/config/retry))
- **Type:**

```ts
type Retry = number | {
  /**
   * The number of times to retry the test if it fails.
   * @default 0
   */
  count?: number
  /**
   * Delay in milliseconds between retry attempts.
   * @default 0
   */
  delay?: number
  /**
   * Condition to determine if a test should be retried based on the error.
   * - If a RegExp, it is tested against the error message
   * - If a function, called with the TestError object; return true to retry
   *
   * NOTE: Functions can only be used in test files, not in vitest.config.ts,
   * because the configuration is serialized when passed to worker threads.
   *
   * @default undefined (retry on all errors)
   */
  condition?: RegExp | ((error: TestError) => boolean)
}
```

Retry configuration for the test. If a number, specifies how many times to retry. If an object, allows fine-grained retry control.

Note that the object configuration is available only since Vitest 4.1.

### repeats

- **Type:** `number`
- **Default:** `0`

How many times the test will run again. If set to `0` (the default), the test will run only one time.

This can be useful for debugging flaky tests.

### tags <Version>4.1.0</Version> {#tags}

- **Type:** `string[]`
- **Default:** `[]`

Custom user [tags](/guide/test-tags). If the tag is not specified in the [configuration](/config/tags), the test will fail before it starts, unless [`strictTags`](/config/stricttags) is disabled manually.

```ts
import { it } from 'vitest'

it('user returns data from db', { tags: ['db', 'flaky'] }, () => {
  // ...
})
```

### meta <Version>4.1.0</Version> {#meta}

- **Type:** `TaskMeta`

Attaches custom [metadata](/api/advanced/metadata) available in reporters.

::: warning
Vitest merges top-level properties inherited from suites or tags. However, it does not perform a deep merge of nested objects.

```ts
import { describe, test } from 'vitest'

describe(
  'nested meta',
  {
    meta: {
      nested: { object: true, array: false },
    },
  },
  () => {
    test(
      'overrides part of meta',
      {
        meta: {
          nested: { object: false }
        },
      },
      ({ task }) => {
        // task.meta === { nested: { object: false } }
        // notice array got lost because "nested" object was overriden
      }
    )
  }
)
```

Prefer using non-nested meta, if possible.
:::

### concurrent

- **Type:** `boolean`
- **Default:** `false` (configured by [`sequence.concurrent`](/config/sequence#sequence-concurrent))
- **Alias:** [`test.concurrent`](#test-concurrent)

Whether this test run concurrently with other concurrent tests in the suite.

### sequential

- **Type:** `boolean`
- **Default:** `true`
- **Alias:** [`test.sequential`](#test-sequential)

Whether tests run sequentially. When both `concurrent` and `sequential` are specified, `concurrent` takes precendence.

### skip

- **Type:** `boolean`
- **Default:** `false`
- **Alias:** [`test.skip`](#test-skip)

Whether the test should be skipped.

### only

- **Type:** `boolean`
- **Default:** `false`
- **Alias:** [`test.only`](#test-only)

Should this test be the only one running in a suite.

### todo

- **Type:** `boolean`
- **Default:** `false`
- **Alias:** [`test.todo`](#test-todo)

Whether the test should be skipped and marked as a todo.

### fails

- **Type:** `boolean`
- **Default:** `false`
- **Alias:** [`test.fails`](#test-fails)

Whether the test is expected to fail. If it does, the test will pass, otherwise it will fail.

## test.extend

- **Alias:** `it.extend`

Use `test.extend` to extend the test context with custom fixtures. This will return a new `test` and it's also extendable, so you can compose more fixtures or override existing ones by extending it as you need. See [Extend Test Context](/guide/test-context#extend-test-context) for more information.

```ts
import { test as baseTest, expect } from 'vitest'

export const test = baseTest
  // Simple value - type is inferred as { port: number; host: string }
  .extend('config', { port: 3000, host: 'localhost' })
  // Function fixture - type is inferred from return value
  .extend('server', async ({ config }) => {
    // TypeScript knows config is { port: number; host: string }
    return `http://${config.host}:${config.port}`
  })

test('server uses correct port', ({ config, server }) => {
  // TypeScript knows the types:
  // - config is { port: number; host: string }
  // - server is string
  expect(server).toBe('http://localhost:3000')
  expect(config.port).toBe(3000)
})
```

## test.override <Version>4.1.0</Version> {#test-override}

Use `test.override` to override fixture values for all tests within the current suite and its nested suites. This must be called at the top level of a `describe` block. See [Overriding Fixture Values](/guide/test-context.html#overriding-fixture-values) for more information.

```ts
import { test as baseTest, describe, expect } from 'vitest'

const test = baseTest
  .extend('dependency', 'default')
  .extend('dependant', ({ dependency }) => dependency)

describe('use scoped values', () => {
  test.override({ dependency: 'new' })

  test('uses scoped value', ({ dependant }) => {
    // `dependant` uses the new overridden value that is scoped
    // to all tests in this suite
    expect(dependant).toEqual({ dependency: 'new' })
  })
})
```

## test.scoped <Version>3.1.0</Version> <Deprecated /> {#test-scoped}

- **Alias:** `it.scoped`

::: danger DEPRECATED
`test.scoped` is deprecated in favor of [`test.override`](#test-override) and will be removed in a future major version.
:::

Alias of [`test.override`](#test-override)

## test.skip

- **Alias:** `it.skip`

If you want to skip running certain tests, but you don't want to delete the code due to any reason, you can use `test.skip` to avoid running them.

```ts
import { assert, test } from 'vitest'

test.skip('skipped test', () => {
  // Test skipped, no error
  assert.equal(Math.sqrt(4), 3)
})
```

You can also skip test by calling `skip` on its [context](/guide/test-context) dynamically:

```ts
import { assert, test } from 'vitest'

test('skipped test', (context) => {
  context.skip()
  // Test skipped, no error
  assert.equal(Math.sqrt(4), 3)
})
```

If the condition is unknown, you can provide it to the `skip` method as the first arguments:

```ts
import { assert, test } from 'vitest'

test('skipped test', (context) => {
  context.skip(Math.random() < 0.5, 'optional message')
  // Test skipped, no error
  assert.equal(Math.sqrt(4), 3)
})
```

## test.skipIf

- **Alias:** `it.skipIf`

In some cases you might run tests multiple times with different environments, and some of the tests might be environment-specific. Instead of wrapping the test code with `if`, you can use `test.skipIf` to skip the test whenever the condition is truthy.

```ts
import { assert, test } from 'vitest'

const isDev = process.env.NODE_ENV === 'development'

test.skipIf(isDev)('prod only test', () => {
  // this test only runs in production
})
```

## test.runIf

- **Alias:** `it.runIf`

Opposite of [test.skipIf](#test-skipif).

```ts
import { assert, test } from 'vitest'

const isDev = process.env.NODE_ENV === 'development'

test.runIf(isDev)('dev only test', () => {
  // this test only runs in development
})
```

## test.only

- **Alias:** `it.only`

Use `test.only` to only run certain tests in a given suite. This is useful when debugging.

```ts
import { assert, test } from 'vitest'

test.only('test', () => {
  // Only this test (and others marked with only) are run
  assert.equal(Math.sqrt(4), 2)
})
```

Sometimes it is very useful to run `only` tests in a certain file, ignoring all other tests from the whole test suite, which pollute the output.

In order to do that, run `vitest` with specific file containing the tests in question:

```shell
vitest interesting.test.ts
```

::: warning
Vitest detects when tests are running in CI and will throw an error if any test has `only` flag. You can configure this behaviour via [`allowOnly`](/config/allowonly) option.
:::

## test.concurrent

- **Alias:** `it.concurrent`

`test.concurrent` marks consecutive tests to be run in parallel. It receives the test name, an async function with the tests to collect, and an optional timeout (in milliseconds).

```ts
import { describe, test } from 'vitest'

// The two tests marked with concurrent will be run in parallel
describe('suite', () => {
  test('serial test', async () => { /* ... */ })
  test.concurrent('concurrent test 1', async () => { /* ... */ })
  test.concurrent('concurrent test 2', async () => { /* ... */ })
})
```

`test.skip`, `test.only`, and `test.todo` works with concurrent tests. All the following combinations are valid:

```ts
test.concurrent(/* ... */)
test.skip.concurrent(/* ... */) // or test.concurrent.skip(/* ... */)
test.only.concurrent(/* ... */) // or test.concurrent.only(/* ... */)
test.todo.concurrent(/* ... */) // or test.concurrent.todo(/* ... */)
```

When running concurrent tests, Snapshots and Assertions must use `expect` from the local [Test Context](/guide/test-context.md) to ensure the right test is detected.

```ts
test.concurrent('test 1', async ({ expect }) => {
  expect(foo).toMatchSnapshot()
})
test.concurrent('test 2', async ({ expect }) => {
  expect(foo).toMatchSnapshot()
})
```

Note that if tests are synchronous, Vitest will still run them sequentially.

## test.sequential

- **Alias:** `it.sequential`

`test.sequential` marks a test as sequential. This is useful if you want to run tests in sequence within `describe.concurrent` or with the `--sequence.concurrent` command option.

```ts
import { describe, test } from 'vitest'

// with config option { sequence: { concurrent: true } }
test('concurrent test 1', async () => { /* ... */ })
test('concurrent test 2', async () => { /* ... */ })

test.sequential('sequential test 1', async () => { /* ... */ })
test.sequential('sequential test 2', async () => { /* ... */ })

// within concurrent suite
describe.concurrent('suite', () => {
  test('concurrent test 1', async () => { /* ... */ })
  test('concurrent test 2', async () => { /* ... */ })

  test.sequential('sequential test 1', async () => { /* ... */ })
  test.sequential('sequential test 2', async () => { /* ... */ })
})
```

## test.todo

- **Alias:** `it.todo`

Use `test.todo` to stub tests to be implemented later. An entry will be shown in the report for the tests so you know how many tests you still need to implement.

```ts
// An entry will be shown in the report for this test
test.todo('unimplemented test', () => {
  // failing implementation...
})
```

::: tip
Vitest will automatically mark test as `todo` if test has no body.
:::

## test.fails

- **Alias:** `it.fails`

Use `test.fails` to indicate that an assertion will fail explicitly.

```ts
import { expect, test } from 'vitest'

test.fails('repro #1234', () => {
  expect(add(1, 2)).toBe(4)
})
```

This flag is useful to track difference in behaviour of your library over time. For example, you can define a failing test without fixing the issue yet due to time constraints. Tests marked with `fails` are tracked in the test summary since Vitest 4.1.

## test.each

- **Alias:** `it.each`

::: tip
While `test.each` is provided for Jest compatibility,
Vitest also has [`test.for`](#test-for) with an additional feature to integrate [`TestContext`](/guide/test-context).
:::

Use `test.each` when you need to run the same test with different variables.
You can inject parameters with [printf formatting](https://nodejs.org/api/util.html#util_util_format_format_args) in the test name in the order of the test function parameters.

- `%s`: string
- `%d`: number
- `%i`: integer
- `%f`: floating point value
- `%j`: json
- `%o`: object
- `%#`: 0-based index of the test case
- `%$`: 1-based index of the test case
- `%%`: single percent sign ('%')

```ts
import { expect, test } from 'vitest'

test.each([
  [1, 1, 2],
  [1, 2, 3],
  [2, 1, 3],
])('add(%i, %i) -> %i', (a, b, expected) => {
  expect(a + b).toBe(expected)
})

// this will return
// ✓ add(1, 1) -> 2
// ✓ add(1, 2) -> 3
// ✓ add(2, 1) -> 3
```

You can also access object properties and array elements with `$` prefix:

```ts
test.each([
  { a: 1, b: 1, expected: 2 },
  { a: 1, b: 2, expected: 3 },
  { a: 2, b: 1, expected: 3 },
])('add($a, $b) -> $expected', ({ a, b, expected }) => {
  expect(a + b).toBe(expected)
})

// this will return
// ✓ add(1, 1) -> 2
// ✓ add(1, 2) -> 3
// ✓ add(2, 1) -> 3

test.each([
  [1, 1, 2],
  [1, 2, 3],
  [2, 1, 3],
])('add($0, $1) -> $2', (a, b, expected) => {
  expect(a + b).toBe(expected)
})

// this will return
// ✓ add(1, 1) -> 2
// ✓ add(1, 2) -> 3
// ✓ add(2, 1) -> 3
```

You can also access Object attributes with `.`, if you are using objects as arguments:

  ```ts
  test.each`
  a               | b      | expected
  ${{ val: 1 }}   | ${'b'} | ${'1b'}
  ${{ val: 2 }}   | ${'b'} | ${'2b'}
  ${{ val: 3 }}   | ${'b'} | ${'3b'}
  `('add($a.val, $b) -> $expected', ({ a, b, expected }) => {
    expect(a.val + b).toBe(expected)
  })

  // this will return
  // ✓ add(1, b) -> 1b
  // ✓ add(2, b) -> 2b
  // ✓ add(3, b) -> 3b
  ```

* First row should be column names, separated by `|`;
* One or more subsequent rows of data supplied as template literal expressions using `${value}` syntax.

```ts
import { expect, test } from 'vitest'

test.each`
  a               | b      | expected
  ${1}            | ${1}   | ${2}
  ${'a'}          | ${'b'} | ${'ab'}
  ${[]}           | ${'b'} | ${'b'}
  ${{}}           | ${'b'} | ${'[object Object]b'}
  ${{ asd: 1 }}   | ${'b'} | ${'[object Object]b'}
`('returns $expected when $a is added $b', ({ a, b, expected }) => {
  expect(a + b).toBe(expected)
})
```

::: tip
Vitest processes `$values` with Chai `format` method. If the value is too truncated, you can increase [chaiConfig.truncateThreshold](/config/chaiconfig#chaiconfig-truncatethreshold) in your config file.
:::

## test.for

- **Alias:** `it.for`

Alternative to `test.each` to provide [`TestContext`](/guide/test-context).

The difference from `test.each` lies in how arrays are provided in the arguments.
Non-array arguments to `test.for` (including template string usage) work exactly the same as for `test.each`.

```ts
// `each` spreads arrays
test.each([
  [1, 1, 2],
  [1, 2, 3],
  [2, 1, 3],
])('add(%i, %i) -> %i', (a, b, expected) => { // [!code --]
  expect(a + b).toBe(expected)
})

// `for` doesn't spread arrays (notice the square brackets around the arguments)
test.for([
  [1, 1, 2],
  [1, 2, 3],
  [2, 1, 3],
])('add(%i, %i) -> %i', ([a, b, expected]) => { // [!code ++]
  expect(a + b).toBe(expected)
})
```

The 2nd argument is [`TestContext`](/guide/test-context) and can be used for concurrent snapshots, for example:

```ts
test.concurrent.for([
  [1, 1],
  [1, 2],
  [2, 1],
])('add(%i, %i)', ([a, b], { expect }) => {
  expect(a + b).toMatchSnapshot()
})
```

## test.describe <Version>4.1.0</Version> {#test-describe}

Scoped `describe`. See [describe](/api/describe) for more information.

## test.suite <Version>4.1.0</Version> {#test-suite}

Alias for `suite`. See [describe](/api/describe) for more information.

## test.beforeEach

Scoped `beforeEach` hook that inherits types from [`test.extend`](#test-extend). See [beforeEach](/api/hooks#beforeeach) for more information.

## test.afterEach

Scoped `afterEach` hook that inherits types from [`test.extend`](#test-extend). See [afterEach](/api/hooks#aftereach) for more information.

## test.beforeAll

Scoped `beforeAll` hook that inherits types from [`test.extend`](#test-extend). See [beforeAll](/api/hooks#beforeall) for more information.

## test.afterAll

Scoped `afterAll` hook that inherits types from [`test.extend`](#test-extend). See [afterAll](/api/hooks#afterall) for more information.

## test.aroundEach <Version>4.1.0</Version> {#test-aroundeach}

Scoped `aroundEach` hook that inherits types from [`test.extend`](#test-extend). See [aroundEach](/api/hooks#aroundeach) for more information.

## test.aroundAll <Version>4.1.0</Version> {#test-aroundall}

Scoped `aroundAll` hook that inherits types from [`test.extend`](#test-extend). See [aroundAll](/api/hooks#aroundall) for more information.

## bench <Experimental /> {#bench}

- **Type:** `(name: string | Function, fn: BenchFunction, options?: BenchOptions) => void`

::: danger
Benchmarking is experimental and does not follow SemVer.
:::

`bench` defines a benchmark. In Vitest terms, benchmark is a function that defines a series of operations. Vitest runs this function multiple times to display different performance results.

Vitest uses the [`tinybench`](https://github.com/tinylibs/tinybench) library under the hood, inheriting all its options that can be used as a third argument.

```ts
import { bench } from 'vitest'

bench('normal sorting', () => {
  const x = [1, 5, 4, 2, 3]
  x.sort((a, b) => {
    return a - b
  })
}, { time: 1000 })
```

```ts
export interface Options {
  /**
   * time needed for running a benchmark task (milliseconds)
   * @default 500
   */
  time?: number

  /**
   * number of times that a task should run if even the time option is finished
   * @default 10
   */
  iterations?: number

  /**
   * function to get the current timestamp in milliseconds
   */
  now?: () => number

  /**
   * An AbortSignal for aborting the benchmark
   */
  signal?: AbortSignal

  /**
   * Throw if a task fails (events will not work if true)
   */
  throws?: boolean

  /**
   * warmup time (milliseconds)
   * @default 100ms
   */
  warmupTime?: number

  /**
   * warmup iterations
   * @default 5
   */
  warmupIterations?: number

  /**
   * setup function to run before each benchmark task (cycle)
   */
  setup?: Hook

  /**
   * teardown function to run after each benchmark task (cycle)
   */
  teardown?: Hook
}
```
After the test case is run, the output structure information is as follows:

```
  name                      hz     min     max    mean     p75     p99    p995    p999     rme  samples
· normal sorting  6,526,368.12  0.0001  0.3638  0.0002  0.0002  0.0002  0.0002  0.0004  ±1.41%   652638
```
```ts
export interface TaskResult {
  /*
   * the last error that was thrown while running the task
   */
  error?: unknown

  /**
   * The amount of time in milliseconds to run the benchmark task (cycle).
   */
  totalTime: number

  /**
   * the minimum value in the samples
   */
  min: number
  /**
   * the maximum value in the samples
   */
  max: number

  /**
   * the number of operations per second
   */
  hz: number

  /**
   * how long each operation takes (ms)
   */
  period: number

  /**
   * task samples of each task iteration time (ms)
   */
  samples: number[]

  /**
   * samples mean/average (estimate of the population mean)
   */
  mean: number

  /**
   * samples variance (estimate of the population variance)
   */
  variance: number

  /**
   * samples standard deviation (estimate of the population standard deviation)
   */
  sd: number

  /**
   * standard error of the mean (a.k.a. the standard deviation of the sampling distribution of the sample mean)
   */
  sem: number

  /**
   * degrees of freedom
   */
  df: number

  /**
   * critical value of the samples
   */
  critical: number

  /**
   * margin of error
   */
  moe: number

  /**
   * relative margin of error
   */
  rme: number

  /**
   * median absolute deviation
   */
  mad: number

  /**
   * p50/median percentile
   */
  p50: number

  /**
   * p75 percentile
   */
  p75: number

  /**
   * p99 percentile
   */
  p99: number

  /**
   * p995 percentile
   */
  p995: number

  /**
   * p999 percentile
   */
  p999: number
}
```

### bench.skip

- **Type:** `(name: string | Function, fn: BenchFunction, options?: BenchOptions) => void`

You can use `bench.skip` syntax to skip running certain benchmarks.

```ts
import { bench } from 'vitest'

bench.skip('normal sorting', () => {
  const x = [1, 5, 4, 2, 3]
  x.sort((a, b) => {
    return a - b
  })
})
```

### bench.only

- **Type:** `(name: string | Function, fn: BenchFunction, options?: BenchOptions) => void`

Use `bench.only` to only run certain benchmarks in a given suite. This is useful when debugging.

```ts
import { bench } from 'vitest'

bench.only('normal sorting', () => {
  const x = [1, 5, 4, 2, 3]
  x.sort((a, b) => {
    return a - b
  })
})
```

### bench.todo

- **Type:** `(name: string | Function) => void`

Use `bench.todo` to stub benchmarks to be implemented later.

```ts
import { bench } from 'vitest'

bench.todo('unimplemented test')
```
