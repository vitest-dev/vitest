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
