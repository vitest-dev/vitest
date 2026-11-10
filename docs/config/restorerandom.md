---
title: restoreRandom | Config
outline: deep
---

# restoreRandom <Experimental /> <Version type="experimental">5.2.0</Version> {#restorerandom}

- **Type:** `boolean`
- **Default:** `false`

Should Vitest automatically call [`vi.useRealRandom()`](/api/vi#vi-userealrandom) before each test. Then each test starts with the real `Math.random`, `crypto` and `node:crypto` functions, also if an earlier test called [`vi.useFakeRandom()`](/api/vi#vi-usefakerandom) and did not restore them.

```js [vitest.config.js]
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    restoreRandom: true,
  },
})
```

Vitest restores the functions before the `beforeEach` hooks, so a `beforeEach` hook can call `vi.useFakeRandom()`. A call at the top level of a file or in `beforeAll` has no effect in the tests.

Vitest restores only the global functions and `node:crypto`. A module that kept a reference to the fake functions when it loaded, for example lodash after a setup file called `vi.useFakeRandom()`, still returns seeded values.

This option cannot be used together with [`fakeRandom`](/config/fakerandom).

::: warning
Tests that run at the same time (see [`test.concurrent`](/api/test#test-concurrent)) share these functions. When one test starts, Vitest also restores the real functions for the other tests that still run.
:::
