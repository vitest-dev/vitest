---
title: logHeapUsage | Config
outline: deep
---

# logHeapUsage

- **Type:** `boolean`
- **Default:** `false`
- **CLI:** `--logHeapUsage`, `--logHeapUsage=false`

Show heap usage after each test. Useful for debugging memory leaks.

:::info
In environments where `process.memoryUsage` is not available (e.g. browser mode), this option is silently ignored.
:::
