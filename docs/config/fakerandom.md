---
title: fakeRandom | Config
outline: deep
---

# fakeRandom <Experimental /> <Version type="experimental">5.2.0</Version> {#fakerandom}

- **Type:** `{ enableGlobally?: boolean }`

Options for [`vi.useFakeRandom()`](/api/vi#vi-usefakerandom).

## fakeRandom.enableGlobally

- **Type:** `boolean`
- **Default:** `false`

Should Vitest automatically call [`vi.useFakeRandom()`](/api/vi#vi-usefakerandom) before it imports the setup files and the test file. Then `Math.random`, `crypto` and `node:crypto` return values from the [`seed`](/config/seed) option in the whole file, also in libraries that keep a reference to these functions when they load, such as lodash and `uuid`.

```js [vitest.config.js]
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    fakeRandom: {
      enableGlobally: true,
    },
  },
})
```

If a test calls [`vi.useRealRandom()`](/api/vi#vi-userealrandom), Vitest calls `vi.useFakeRandom()` again before the next test.

A module keeps the functions that it found when it loaded. So a module that kept the fake functions still returns seeded values after `vi.useRealRandom()`. A module that loaded before Vitest imported the setup files, for example in a custom [environment](/config/environment), still returns real values. For other values that the fake cannot repeat, see [`vi.useFakeRandom`](/api/vi#vi-usefakerandom).

This option cannot be used together with [`restoreRandom`](/config/restorerandom).

::: warning
Tests that run at the same time (see [`test.concurrent`](/api/test#test-concurrent)) share these functions, so their values would depend on the order of the calls. The fake functions throw an error in concurrent tests and suites. Use [`context.random`](/guide/test-context#random) in concurrent tests.
:::
