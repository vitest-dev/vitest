---
title: teardownTimeout | Config
outline: deep
---

# teardownTimeout <CRoot /> {#teardowntimeout}

- **Type:** `number`
- **Default:** `10000`
- **CLI:** `--teardown-timeout=5000`, `--teardownTimeout=5000`

Default timeout to wait for close when Vitest shuts down, in milliseconds

::: warning DEPRECATED
Use [`timeout.teardown`](/config/timeout#timeout-teardown) instead. If both are set, `timeout.teardown` takes precedence.
:::
