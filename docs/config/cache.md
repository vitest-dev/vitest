---
title: cache | Config
outline: deep
---

# cache <CRoot />

- **Type**: `false`
- **CLI**: `--no-cache`, `--cache=false`

Use this option if you want to disable the cache feature. At the moment Vitest stores cache for test results to run the longer and failed tests first.

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
