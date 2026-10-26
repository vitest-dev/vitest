---
title: isolate | Config
outline: deep
---

# isolate

- **Type:** `boolean`
- **Default:** `true`
- **CLI:** `--no-isolate`, `--isolate=false`

Run tests in an isolated environment. This option has no effect on `vmThreads` and `vmForks` pools.

::: warning Browser Mode
In Browser Mode, a page runs its test files one after another in the same document when `isolate` is `false`. The browser keeps one instance per module URL for the lifetime of the document, so the files share every module they import, and a module that one file mocked stays mocked for the files that run after it in the same page. Vitest reports an error when a file mocks a module that the page already imported, and when a file imports a module that an earlier file mocked. See [Mocking with `isolate: false`](/guide/mocking/modules#mocking-with-isolate-false) for the patterns that work without isolation.
:::

Disabling this option might [improve performance](/guide/improving-performance) if your code doesn't rely on side effects (which is usually true for projects with `node` environment).

::: tip
You can disable isolation for specific test files by using Vitest workspaces and disabling isolation per project.
:::
