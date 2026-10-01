---
title: browser.dependencySourcemaps | Config
outline: deep
---

# browser.dependencySourcemaps

- **Type:** `boolean`
- **Default:** `true`

Serve sourcemaps of your dependencies (files in `node_modules`) to the browser during headless test runs.

These sourcemaps are used by browser devtools: with `dependencySourcemaps: false`, pausing inside dependency code shows the compiled code the browser actually runs instead of the dependency's original sources. If you don't debug into your dependencies this way, disabling them makes test runs faster: the server doesn't generate and inline the maps, and every browser tab downloads several times fewer bytes.

Reported test errors are not affected: when an error is thrown inside a pre-bundled dependency, Vitest maps its stack frames using the sourcemaps stored on disk even when this option is disabled. Frames from dependencies that are served without pre-bundling (for example, [linked packages](https://vite.dev/guide/dep-pre-bundling#monorepos-and-linked-dependencies)) that don't ship their own sourcemaps fall back to the position in the served code, which usually matches the original file.

Vitest never serves sourcemaps of its own pre-built modules in headless runs (unless [`--inspect`](/guide/cli#inspect) is used) — their frames are hidden from stack traces anyway. Sourcemaps of your own source files are always served.

::: tip
If some of your workspace code resolves to a `node_modules` path (for example, with `resolve.preserveSymlinks`), set [`server.sourcemapIgnoreList`](https://vite.dev/config/server-options#server-sourcemapignorelist) to keep its sourcemaps even when this option is disabled.
:::
