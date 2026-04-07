---
title: resolveSnapshotPath | Config
outline: deep
---

# resolveSnapshotPath <CRoot />

- **Type**: `(testPath: string, snapExtension: string, context: { config: SerializedConfig }) => string`
- **Default**: stores snapshot files in `__snapshots__` directory

Overrides default snapshot path. For example, to store snapshots next to test files:

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    resolveSnapshotPath: (testPath, snapExtension) => testPath + snapExtension,
  },
})
```

You can also use the `context` parameter to access the project's serialized config. This is useful when you have multiple [projects](/guide/projects) and want to store snapshots in different locations based on the project name:

```ts
import { basename, dirname, join } from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    resolveSnapshotPath(testPath, snapExtension, context) {
      return join(
        dirname(testPath),
        '__snapshots__',
        context.config.name ?? 'default',
        basename(testPath) + snapExtension,
      )
    },
  },
})
```
