---
title: benchmark | Config
outline: deep
---

# benchmark <Experimental /> {#benchmark}

- **Type:** `{ include?, exclude?, ... }`

Options used when running `vitest bench`.

## benchmark.enabled

- **Type:** `boolean`
- **Default:** `false`

Enables the benchmark project. When set, Vitest creates a dedicated benchmark project alongside your regular test project, runs files matching [`benchmark.include`](#benchmark-include) in it, and exposes the [`bench` fixture](/guide/test-context#bench) to those files. Running `vitest bench` enables this automatically.

## benchmark.include

- **Type:** `string[]`
- **Default:** `['**/*.{bench,benchmark}.?(c|m)[jt]s?(x)']`

Include globs for benchmark test files

## benchmark.exclude

- **Type:** `string[]`
- **Default:** `['node_modules', 'dist', '.idea', '.git', '.cache']`

Exclude globs for benchmark test files

## benchmark.includeSource

- **Type:** `string[]`
- **Default:** `[]`

Include globs for in-source benchmark test files. This option is similar to [`includeSource`](/config/include-source).

When defined, Vitest will run all matched files with `import.meta.vitest` inside.

## benchmark.retainSamples

- **Type:** `boolean`
- **Default:** `false`

Include the `samples` array of per-iteration timings on every benchmark result. Off by default to reduce memory usage; enable when a custom reporter or API consumer needs the raw samples.

## benchmark.updateBaselines

- **Type:** `boolean`
- **Default:** `false`
- **CLI:** `--update-baselines`

Overwrite stored benchmark baselines with fresh results. Baselines are created by [`bench.withBaseline()`](/guide/benchmarking#baselines) and stored in a `__benchmarks__/<file>.json` file next to each benchmark file. When `false` (the default), `bench.withBaseline()` reuses the stored result instead of re-running the benchmark; set this to `true` (or pass `--update-baselines` on the CLI) to regenerate the baselines.
