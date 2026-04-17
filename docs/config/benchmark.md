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

Include globs for in-source benchmark test files. This option is similar to [`includeSource`](/config/include-source).

When defined, Vitest will run all matched files with `import.meta.vitest` inside.

## benchmark.retainSamples

Include `samples` array of benchmark results for API or custom reporter usages.
