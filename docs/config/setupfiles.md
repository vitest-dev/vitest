---
title: setupFiles | Config
outline: deep
---

# setupFiles

- **Type:** `string | string[]`

Path to setup files. They will be run before each test file.

:::info
Editing a setup file will automatically trigger a rerun of all tests.
:::

You can use `process.env.VITEST_POOL_ID` (integer-like string) inside to distinguish between workers.

:::tip
Note, that if you are running [`--isolate=false`](#isolate), this setup file will be run in the same global scope multiple times. Meaning, that you are accessing the same global object before each test, so make sure you are not doing the same thing more than you need.
:::

For example, you may rely on a global variable:

```ts
import { config } from '@some-testing-lib'

if (!globalThis.defined) {
  config.plugins = [myCoolPlugin]
  computeHeavyThing()
  globalThis.defined = true
}

// hooks are reset before each suite
afterEach(() => {
  cleanup()
})

globalThis.resetBeforeEachTest = true
```
