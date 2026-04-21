---
title: isolate | Config
outline: deep
---

# isolate

- **Type:** `boolean`
- **Default:** `true`
- **CLI:** `--no-isolate`, `--isolate=false`

Run tests in an isolated environment. This option has no effect on `vmThreads` and `vmForks` pools.

Disabling this option might [improve performance](/guide/improving-performance) if your code doesn't rely on side effects (which is usually true for projects with `node` environment).

::: tip
You can disable isolation for specific test files by using Vitest workspaces and disabling isolation per project.
:::
