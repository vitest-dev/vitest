---
title: fsModuleCachePath | Config
outline: deep
---

# fsModuleCachePath <Version>5.0.0</Version>

- **Type:** `string`
- **Default:** `'node_modules/.vitest-cache'` (resolved from the workspace root)
- **CLI:** `--fsModuleCachePath=<path>`

Directory where the [`fsModuleCache`](/config/fsmodulecache) is stored.

This can be set per project; projects that don't override it fall back to the root's cache directory. The lockfile metadata used to invalidate the cache is always shared across the whole workspace.

By default Vitest stores the cache inside `node_modules` at the workspace root. The root is based on your package manager's lockfile (for example, `.package-lock.json`, `.yarn-state.yml`, `.pnpm/lock.yaml` and so on). Keeping it inside `node_modules` means the cache is naturally invalidated whenever dependencies are reinstalled.

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    fsModuleCache: true,
    fsModuleCachePath: 'node_modules/.vitest-cache',
  },
})
```
