---
title: benchmark | Config
outline: deep
---

# benchmark <Experimental /> {#benchmark}

- **Type:** `{ include?, exclude?, ... }`

Options used when running `vitest bench`.

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

Include globs for in-source benchmark test files. This option is similar to [`includeSource`](#includesource).

When defined, Vitest will run all matched files with `import.meta.vitest` inside.

## benchmark.reporters

- **Type:** `Arrayable<BenchmarkBuiltinReporters | Reporter>`
- **Default:** `'default'`

Custom reporter for output. Can contain one or more built-in report names, reporter instances, and/or paths to custom reporters.

## benchmark.outputFile

Deprecated in favor of `benchmark.outputJson`.

## benchmark.outputJson {#benchmark-outputJson}

- **Type:** `string | undefined`
- **Default:** `undefined`

A file path to store the benchmark result, which can be used for `--compare` option later.

For example:

```sh
# save main branch's result
git checkout main
vitest bench --outputJson main.json

# change a branch and compare against main
git checkout feature
vitest bench --compare main.json
```

## benchmark.compare {#benchmark-compare}

- **Type:** `string | undefined`
- **Default:** `undefined`

A file path to a previous benchmark result to compare against current runs.
