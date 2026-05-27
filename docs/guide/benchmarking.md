---
title: Benchmarking | Guide
---

# Benchmarking

Vitest lets you write benchmarks alongside your tests using the `bench` fixture from the [test context](/guide/test-context). It is not a top-level import from `vitest`. Benchmarks are powered by [Tinybench](https://github.com/tinylibs/tinybench) and are defined inside regular `test()` calls, giving you access to the full power of Vitest's test runner: retries, lifecycle hooks, filtering, and assertions.

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

::: warning
The `bench` fixture is only available in files matched by [`benchmark.include`](/config/#benchmark-include) (default: `**/*.{bench,benchmark}.?(c|m)[jt]s?(x)`). Using `{ bench }` inside a regular test file will throw an error, and `bench` is not exported from `vitest` as a top-level import.

Whether a file participates in the benchmark run is decided by the filename, not by whether the test uses the `bench` fixture. Renaming `parser.test.ts` to `parser.bench.ts` (or adjusting `benchmark.include`) is what moves it into the benchmark project.
:::

## Running Benchmarks

Benchmark files are matched by [`benchmark.include`](/config/#benchmark-include) (default: `**/*.{bench,benchmark}.?(c|m)[jt]s?(x)`) and run in their own project, separate from your regular tests. There are three ways to run them, depending on whether you want to skip them, run them alongside tests, or run them on their own.

### `vitest` (default)

Without [`benchmark.enabled`](/config/#benchmark-enabled), the `vitest` command only runs regular tests. Benchmark files are ignored entirely. This is the default and the right choice for day-to-day development, since benchmarks are slow and noisy and shouldn't run on every save.

### `vitest` with `benchmark.enabled`

Set `benchmark.enabled: true` in your config to run benchmarks together with regular tests:

```ts [vitest.config.ts]
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    benchmark: {
      enabled: true,
    },
  },
})
```

With this config, `vitest` runs your regular tests first, then runs the benchmarks in a separate isolated group (so benchmark execution never overlaps with test execution and adds noise to results). Useful in CI when you want a single command to validate correctness and performance.

### `vitest bench`

The `bench` subcommand runs only benchmarks and skips regular tests:

```bash
vitest bench
```

This implicitly enables `benchmark.enabled` for the run, so you don't need to set it in the config. Like the `vitest` command, it accepts filename filters and `-t`/`--testNamePattern` to narrow the run:

```bash
# only benchmarks in files matching "parser"
vitest bench parser

# only benchmarks whose test name matches "JSON"
vitest bench -t JSON
```

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

You can also pass per-benchmark [options](https://tinylibs.github.io/tinybench/interfaces/FnOptions.html) as the second argument, matching how `test()` accepts options:

```ts
test('benchmarks with setup', async ({ bench }) => {
  const result = await bench.compare(
    bench('with-cache', () => {
      readFromCache()
    }),
    bench(
      'without-cache',
      { beforeEach: () => clearCache() },
      () => { readFromDisk() },
    ),
  )
})
```

## Comparing Across Projects

When your workspace defines multiple projects (e.g., different browsers or runtimes), pass `perProject: true` in the bench options to compare how the same benchmark performs across all of them. Vitest still prints the result inline for the current project, and additionally collects per-project results into a single comparison table at the end of the test run.

```ts
import { test } from 'vitest'

test('simple example', async ({ bench }) => {
  await bench('1 + 1', { perProject: true }, () => {
    1 + 1
  }).run()
})
```

The same test file runs in each project (chromium, firefox, webkit, etc.), and Vitest groups the results:

<<< ./snippets/benchmark-per-project.ansi

You can also mix `perProject` benchmarks with regular ones inside `bench.compare()`:

```ts
test('compare implementations across browsers', async ({ bench }) => {
  await bench.compare(
    bench('JSON.parse', { perProject: true }, () => {
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

## Storing and Replaying Results

Two primitives let you persist benchmark results to disk and compare against them in future runs: the `writeResult` option saves a result, and `bench.from()` reads one back.

### `writeResult`

Pass `writeResult` as a per-bench option to write the result to a JSON file every time the benchmark runs. The path is resolved against the project root:

```ts
test('parse', async ({ bench }) => {
  await bench(
    'parse',
    { writeResult: './benchmarks/parse.json' },
    () => parse(largeInput),
  ).run()
})
```

- The benchmark always runs. There is no skip-when-cached behaviour and no CLI flag, the file is overwritten on every successful run.
- If the function throws, the file is not written.
- Commit these files alongside your code so reviewers and CI share the same reference points.

::: warning
If you commit these files, keep in mind that benchmark results vary significantly between environments (developer machines, CI runners, different OSes). Designate a single environment (typically CI) to generate the file, and avoid regenerating it locally.
:::

### `bench.from()`

`bench.from(name, source)` is a registration that doesn't execute a function. It reads a previously stored result and feeds it into `bench.compare()` (or returns it directly when you call `.run()`).

The source can be a path (relative to the project root) or a function that returns the result data, including a Promise:

```ts
test('compare against the stored baseline', async ({ bench }) => {
  const result = await bench.compare(
    bench(
      'current',
      { writeResult: './benchmarks/parse.json' },
      () => parse(largeInput),
    ),
    bench.from('previous', './benchmarks/parse.json'),
    bench.from('remote', () => fetch('https://path/to/external/file.json').then(r => r.json())),
  )

  expect(result.get('current')).toBeFasterThan(result.get('previous'))
})
```

You can keep historical artifacts for older versions and compare them against the current implementation. Because `bench.from()` never invokes the function that produced the file, the original benchmark code can be deleted once the artifact is committed:

```ts
test('compare parser versions', async ({ bench }) => {
  const input = '{"key":"value"}'

  await bench.compare(
    bench.from('v1', './benchmarks/parse.v1.json'),
    bench.from('v2', './benchmarks/parse.v2.json'),
    bench(
      'current',
      { writeResult: './benchmarks/parse.current.json' },
      () => customParser(input),
    ),
  )
})
```

To produce a new historical artifact, point a fresh `bench()` at that version's implementation, set `writeResult` to a versioned path (`./benchmarks/parse.v3.json`), run it once, then replace the call with `bench.from('v3', './benchmarks/parse.v3.json')`.

To regenerate the baseline on demand, gate the write behind an environment variable so the same test either refreshes the artifact or compares against it:

```ts
test('compare parser versions', async ({ bench }) => {
  if (import.meta.env.VITE_WRITE_BENCH) {
    const baseline = bench('baseline', { writeResult: './my-bench.json' }, () => fn())
    await baseline.run()
  }
  else {
    const baseline = bench.from('baseline', './my-bench.json')
    await bench.compare(bench('current', () => fn()), baseline)
  }
})
```

Run `VITE_WRITE_BENCH=1 vitest bench` to refresh the stored result, and `vitest bench` to compare the current implementation against it.

### Per-project artifacts

In a multi-project workspace (different browsers, different runtimes), share one benchmark file across projects by including `${projectName}` in the path. The placeholder is substituted with the current project name at write time:

```ts
test('cross-project baseline', async ({ bench }) => {
  await bench(
    'parse',
    // eslint-disable-next-line no-template-curly-in-string
    { perProject: true, writeResult: './benchmarks/parse.${projectName}.json' },
    () => parse(largeInput),
  ).run()
})
```

Use the same template in `bench.from()` so each project reads its own artifact.

## Stability

Benchmarks are inherently flaky: CPU load, thermal throttling, GC pressure, and background processes all affect results. Vitest takes several steps to minimize this noise:

- **Separate project**: Benchmark files are grouped into their own project based on the [`benchmark.include`](/config/#benchmark-include) pattern. The `bench` fixture is only exposed in files matched by that pattern. Using it inside a regular test file will throw an error, and `bench` is not available as a top-level import from `vitest`.
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
  // BAD: the engine may eliminate the work
  await bench('parse', () => {
    JSON.parse(input)
  }).run()

  // GOOD: the result is consumed
  await bench('parse', () => {
    const result = JSON.parse(input)
    doSomething(result)
  }).run()
})
```

This applies to all engines (V8, JavaScriptCore, SpiderMonkey) but is especially aggressive in V8's TurboFan and JavaScriptCore's FTL compiler tiers.

### Module Runner Overhead

By default, Vitest runs tests in Node.js using Vite's module runner (configured by [`experimental.viteModuleRunner`](/config/experimental#experimental-vitemodulerunner)). This transforms all module exports into getters, so every access to an imported binding goes through something like `__vite_ssr_module__.value`. In regular tests this overhead is negligible, but in benchmarks where a function is called millions of times, the getter call itself can dominate the measurement.

Vitest will print a warning if it detects excessive getter calls (which you can silence via [`benchmark.suppressExportGetterWarnings`](/config/benchmark#benchmark-suppressexportgetterwarnings)), but you should be aware of this when benchmarking imported functions:

```ts
import { parse } from './parser.js'

const _parse = parse

test('parsing', async ({ bench }) => {
  // BAD: every call to `parse` goes through a getter
  await bench('parse', () => {
    parse(input)
  }).run()

  // GOOD: store the reference locally to bypass the getter
  await bench('parse', () => {
    _parse(input)
  }).run()
})
```

If you are the library author, the same overhead applies inside the library you are benchmarking: every cross-module call within its source goes through the same getter wrapper. If you are benchmarking your own library, you have two ways to remove this:

**Benchmark the pre-built artifact.** Import the library through its package name (which resolves to its built output) instead of reaching into its source. The built file has already collapsed internal imports into direct references, so Vite's module runner sees a single module with no internal getters:

```ts
// BAD: every internal call inside the library goes through a getter
import { parse } from '../src/index.ts'

// GOOD: the published entry has no internal getters
import { parse } from 'my-library'
```

If you compare your library against other packages, benchmark the same kind of artifact for every implementation. For workspace packages, make sure the package name resolves to the built output instead of source, for example by externalizing the package in Vite or by importing from `dist`.

**Disable the module runner for the benchmark.** If the benchmark does not need Vite transforms, mocks, or Vitest module interception, disable [`experimental.viteModuleRunner`](/config/experimental#experimental-vitemodulerunner) for the benchmark project so Node runs native ESM directly.

This only affects Node.js mode. Browser mode uses native ESM imports and does not have this overhead.

### Engine-Specific Considerations

#### V8 (Node.js, Chrome)

- **JIT tiering**: V8 compiles functions through multiple optimization tiers (Sparkplug → Maglev → TurboFan). A function may run at different speeds during warmup vs. steady-state. Tinybench handles warmup automatically, but very short benchmark runs may not reach the highest optimization tier.
- **Deoptimization**: V8 can "bail out" of optimized code mid-benchmark if it encounters unexpected types or shapes. Keep the types consistent in your benchmark function:

  ```ts
  test('process items', async ({ bench }) => {
    // BAD: mixed shapes cause deoptimization
    await bench('process', () => {
      for (const item of items) {
        // some items have { name: string }, others have { name: string, id: number }
        process(item)
      }
    }).run()

    // GOOD: consistent object shapes
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

    // BAD: allocates a new array every iteration, GC adds noise
    await bench('sort', () => {
      const data = Array.from({ length: 10000 }, () => Math.random())
      data.sort()
    }).run()

    // GOOD: pre-allocate, copy in beforeEach
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

- **Timer resolution**: Browsers may reduce `performance.now()` precision (e.g., to 100μs or even 1ms) as a security mechanism. This makes very fast operations difficult to measure accurately, so increase iterations to compensate:

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
