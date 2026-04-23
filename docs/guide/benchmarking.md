---
title: Benchmarking | Guide
---

# Benchmarking

Vitest lets you write benchmarks alongside your tests using the `bench` fixture from the [test context](/guide/test-context) — it is not a top-level import from `vitest`. Benchmarks are powered by [Tinybench](https://github.com/tinylibs/tinybench) and are defined inside regular `test()` calls, giving you access to the full power of Vitest's test runner: retries, lifecycle hooks, filtering, and assertions.

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

## Comparing Across Projects

When your workspace defines multiple projects (e.g., different browsers or runtimes), you can use `bench.perProject()` to compare how the same benchmark performs across all of them. Instead of printing results inline per project, Vitest collects them and prints a single comparison table at the end of the test run.

```ts
import { test } from 'vitest'

test('simple example', async ({ bench }) => {
  await bench.perProject('1 + 1', () => {
    1 + 1
  }).run()
})
```

The same test file runs in each project (chromium, firefox, webkit, etc.), and Vitest groups the results:

<<< ./snippets/benchmark-per-project.ansi

`bench.perProject()` returns a `BenchRegistration` just like `bench()`, so you call `.run()` to execute it. You can also mix it with `bench.compare()`:

```ts
test('compare implementations across browsers', async ({ bench }) => {
  await bench.compare(
    bench.perProject('JSON.parse', () => {
      JSON.parse('{"key":"value"}')
    }),
    bench('custom parser', () => {
      customParse('{"key":"value"}')
    }),
  )
})
```

In this case, `custom parser` appears in the normal inline comparison table per project, while `JSON.parse` is additionally collected into the cross-project comparison table at the end.

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
- **Updating baselines**: Use the `--update-baselines` flag to overwrite stored baselines with fresh results.

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

## Stability

Benchmarks are inherently flaky — CPU load, thermal throttling, GC pressure, and background processes all affect results. Vitest takes several steps to minimize this noise:

- **Separate project**: Benchmark files are grouped into their own project based on the [`benchmark.include`](/config/#benchmark-include) pattern. The `bench` fixture is only exposed in files matched by that pattern — using it inside a regular test file will throw an error, and `bench` is not available as a top-level import from `vitest`.
- **No concurrency**: Tests within a benchmark file always run sequentially. Benchmark files themselves also run one at a time, never in parallel. This prevents benchmarks from interfering with each other.

To further improve stability:

- Use the [`retry`](#retries) option to automatically rerun flaky benchmark assertions.
- Use the [`delta`](#asserting-performance) option in `toBeFasterThan` / `toBeSlowerThan` to allow for acceptable variance.
- Avoid running benchmarks alongside CPU-intensive processes.
- Close browsers, IDEs, and other applications that compete for CPU time.

### Dead Code Elimination

JavaScript engines can optimize away code that has no observable side effects. If your benchmark function doesn't use its result, the engine may skip the computation entirely, producing misleadingly fast numbers:

```ts
test('parsing', async ({ bench }) => {
  // BAD — the engine may eliminate the work
  await bench('parse', () => {
    JSON.parse(input)
  }).run()

  // GOOD — the result is consumed
  await bench('parse', () => {
    const result = JSON.parse(input)
    doSomething(result)
  }).run()
})
```

This applies to all engines (V8, JavaScriptCore, SpiderMonkey) but is especially aggressive in V8's TurboFan and JavaScriptCore's FTL compiler tiers.

### Module Runner Overhead

By default, Vitest runs tests in Node.js using Vite's module runner (configured by [`experimental.viteModuleRunner`](/config/experimental#experimental-vitemodulerunner)). This transforms all module exports into getters — every access to an imported binding goes through something like `__vite_ssr_module__.value`. In regular tests this overhead is negligible, but in benchmarks where a function is called millions of times, the getter call itself can dominate the measurement.

Vitest will print a warning if it detects excessive getter calls, but you should be aware of this when benchmarking imported functions:

```ts
import { parse } from './parser.js'

const _parse = parse

test('parsing', async ({ bench }) => {
  // BAD — every call to `parse` goes through a getter
  await bench('parse', () => {
    parse(input)
  }).run()

  // GOOD — store the reference locally to bypass the getter
  await bench('parse', () => {
    _parse(input)
  }).run()
})
```

This only affects Node.js mode. Browser mode uses native ESM imports and does not have this overhead.

### Engine-Specific Considerations

#### V8 (Node.js, Chrome)

- **JIT tiering**: V8 compiles functions through multiple optimization tiers (Sparkplug → Maglev → TurboFan). A function may run at different speeds during warmup vs. steady-state. Tinybench handles warmup automatically, but very short benchmark runs may not reach the highest optimization tier.
- **Deoptimization**: V8 can "bail out" of optimized code mid-benchmark if it encounters unexpected types or shapes. Keep the types consistent in your benchmark function:

  ```ts
  test('process items', async ({ bench }) => {
    // BAD — mixed shapes cause deoptimization
    await bench('process', () => {
      for (const item of items) {
        // some items have { name: string }, others have { name: string, id: number }
        process(item)
      }
    }).run()

    // GOOD — consistent object shapes
    await bench('process', () => {
      for (const item of items) {
        // all items have the same shape { name: string, id: number }
        process(item)
      }
    }).run()
  })
  ```

- **Garbage collection**: Large allocations inside the benchmark loop add GC noise. If you're measuring computation, pre-allocate data in a `setup` hook rather than inside the benchmarked function:

  ```ts
  test('sorting', async ({ bench }) => {
    const original = Array.from({ length: 10000 }, () => Math.random())
    let data: number[]

    // BAD — allocates a new array every iteration, GC adds noise
    await bench('sort', () => {
      const data = Array.from({ length: 10000 }, () => Math.random())
      data.sort()
    }).run()

    // GOOD — pre-allocate, copy in beforeEach
    await bench(
      'sort',
      () => { data.sort() },
      {
        beforeEach() {
          data = [...original]
        },
      },
    ).run()
  })
  ```

#### JavaScriptCore (Bun, Safari)

- **Different optimization thresholds**: JSC uses its own JIT tiers (LLInt → Baseline → DFG → FTL) with different inlining and optimization heuristics. A benchmark that is fast on V8 may behave very differently on JSC.
- **Async benchmarks**: Bun's event loop implementation differs from Node.js. If your benchmark involves async operations or timers, results may not be directly comparable across runtimes.

#### Browser

- **Timer resolution**: Browsers may reduce `performance.now()` precision (e.g., to 100μs or even 1ms) as a Spectre mitigation. This makes very fast operations difficult to measure accurately — increase iterations to compensate:

  ```ts
  test('fast operations', async ({ bench }) => {
    await bench.compare(
      bench('fast-op', () => { fastOp() }),
      bench('other-op', () => { otherOp() }),
      {
        // more iterations help overcome low timer resolution
        iterations: 1000,
      },
    )
  })
  ```
- **Cross-browser differences**: V8 (Chrome), SpiderMonkey (Firefox), and JSC (Safari) optimize different patterns differently. A benchmark that shows one library winning in Chrome may show the opposite in Firefox.
