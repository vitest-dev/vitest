---
title: cache | Config
outline: deep
---

# cache <CRoot />

- **Type:** `boolean`
- **Default:** `true`
- **CLI:** `--cache`, `--no-cache`

Store the results of test runs on the file system. Vitest uses them to run failed and longer test files first.

For every test file, Vitest stores whether the file failed, how long it ran and when it ran last. A run that did not execute the whole file (for example, a run filtered with [`--testNamePattern`](/config/testnamepattern) or cancelled by [`bail`](/config/bail)) can mark the file as failed, but it cannot mark it as passed.

You can delete the cache by running [`vitest --clearCache`](/guide/cli#clearcache).

The cache directory is controlled by the Vite's [`cacheDir`](https://vitejs.dev/config/shared-options.html#cachedir) option:

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  cacheDir: 'custom-folder/.vitest'
})
```

You can limit the directory only for Vitest by using `process.env.VITEST`:

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  cacheDir: process.env.VITEST ? 'custom-folder/.vitest' : undefined
})
```

::: warning
The deprecated `cache.dir` option has no effect anymore. Use `cacheDir` to change the cache directory.
:::
