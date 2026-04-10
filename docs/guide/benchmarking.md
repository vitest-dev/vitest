---
title: Benchmarking | Guide
---

# Benchmarking

Vitest lets you write benchmarks alongside your tests using the `bench` fixture from the [test context](/guide/test-context). Benchmarks are powered by [Tinybench](https://github.com/tinylibs/tinybench) and are defined inside regular `test()` calls, giving you access to the full power of Vitest's test runner: retries, lifecycle hooks, filtering, and assertions.

## Defining a Benchmark

Use the `bench` fixture to define a benchmark. Call `.run()` to execute it:

```ts
import { expect, test } from 'vitest'

test('parsing performance', async ({ bench }) => {
  const result = await bench('parse', () => {
    JSON.parse('{"key":"value"}')
  }).run()
})
```

The `bench()` function registers a benchmark without executing it. Calling `.run()` runs the benchmark and returns the result. Vitest will print the benchmark output (ops/sec, mean time, etc.) after the test completes.

## Comparing Benchmarks

Use `bench.compare()` to compare multiple benchmarks against each other:

```ts
import { expect, test } from 'vitest'

test('compare JSON libraries', async ({ bench }) => {
  const input = '{"key":"value","nested":{"a":1}}'

  const result = await bench.compare(
    bench('JSON.parse', () => {
      JSON.parse(input)
    }),
    bench('custom parser', () => {
      customParse(input)
    }),
  )
})
```

When comparing benchmarks, Vitest runs them using interleaved iterations to reduce environmental bias (CPU throttling, GC pressure, etc.) and prints a comparison table after the test completes:

<<< ./snippets/benchmark-table.ansi

### Options

You can pass [options](https://tinylibs.github.io/tinybench/interfaces/BenchOptions.html) as the last argument to `bench.compare()`:

```ts
test('compare with options', async ({ bench }) => {
  const result = await bench.compare(
    bench('lib1', () => { lib1() }),
    bench('lib2', () => { lib2() }),
    {
      iterations: 100,
      time: 1000,
    },
  )
})
```

You can also pass per-benchmark [options](https://tinylibs.github.io/tinybench/interfaces/FnOptions.html):

```ts
test('benchmarks with setup', async ({ bench }) => {
  const result = await bench.compare(
    bench('with-cache', () => {
      readFromCache()
    }),
    bench(
      'without-cache',
      () => { readFromDisk() },
      {
        beforeEach() {
          clearCache()
        },
      },
    ),
  )
})
```

## Asserting Performance

Use `toBeFasterThan()` and `toBeSlowerThan()` matchers to assert relative performance between benchmarks:

```ts
import { expect, test } from 'vitest'

test('lib1 is faster than lib2', async ({ bench }) => {
  const result = await bench.compare(
    bench('lib1', () => { lib1() }),
    bench('lib2', () => { lib2() }),
  )

  expect(result.get('lib1')).toBeFasterThan(result.get('lib2'))
})
```

The `delta` option specifies the minimum relative difference required for the assertion to pass. This helps avoid flaky tests caused by benchmark noise:

```ts
// lib1 must be at least 10% faster than lib2
expect(result.get('lib1')).toBeFasterThan(result.get('lib2'), {
  delta: 0.1,
})

// lib2 must be at least 20% slower than lib1
expect(result.get('lib2')).toBeSlowerThan(result.get('lib1'), {
  delta: 0.2,
})
```

You can also assert absolute performance using standard matchers:

```ts
test('parsing is fast enough', async ({ bench }) => {
  const result = await bench('parse', () => {
    parse(largeInput)
  }).run()

  expect(result.throughput.mean).toBeGreaterThan(10_000)
})
```

## Retries

Since benchmarks can be noisy, use the `retry` option to automatically retry failing benchmark tests:

```ts
test('performance comparison', { retry: 3 }, async ({ bench }) => {
  const result = await bench.compare(
    bench('lib1', () => { lib1() }),
    bench('lib2', () => { lib2() }),
  )

  expect(result.get('lib1')).toBeFasterThan(result.get('lib2'))
})
```

## Baselines

Use `bench.withBaseline()` to store benchmark results on disk and compare against them in future runs, similar to how [snapshot testing](/guide/snapshot) works:

```ts
test('no performance regression', async ({ bench }) => {
  const result = await bench.withBaseline('parse', () => {
    parse(largeInput)
  }).run()
})
```

- **First run**: Executes the benchmark and stores the result to a `__benchmarks__/` directory next to the test file.
- **Subsequent runs**: Executes the benchmark and compares against the stored result, reporting any regressions.
<!-- TODO -->
- **Updating baselines**: Use the `--update` flag to update stored baselines.

Baselines work inside `bench.compare()` too. You can mix regular and baseline benchmarks:

```ts
test('compare against baseline', async ({ bench }) => {
  const result = await bench.compare(
    bench('current implementation', () => { current() }),
    bench.withBaseline('previous implementation', () => { previous() }),
  )

  expect(result.get('current implementation'))
    .toBeFasterThan(result.get('previous implementation'))
})
```

Baseline files should be committed to version control so the team shares the same reference points.

## Execution Order

Benchmark tests run **after** all regular tests complete. This ensures that:

- Regular tests are not slowed down by benchmark execution
- Benchmarks run sequentially to avoid interference between concurrent benchmarks
- Benchmark results are printed separately from test results
