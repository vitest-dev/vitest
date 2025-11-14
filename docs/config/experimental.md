---
title: experimental | Config
outline: deep
---

# experimental

## fsModuleCache <Version type="warning">4.0.10</Version>

- **Type:** `boolean`
- **Default:** `false`

Enabling this option allows Vitest to keep cached modules on the file system, making tests run faster between reruns.

You can delete the old cache by running `vitest --clearCache`.
