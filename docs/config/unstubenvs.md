---
title: unstubEnvs | Config
outline: deep
---

# unstubEnvs

- **Type:** `boolean`
- **Default:** `false`

Should Vitest automatically call [`vi.unstubAllEnvs()`](/api/vi#vi-unstuballenvs) before each test.

```js [vitest.config.js]
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    unstubEnvs: true,
  },
})
```

::: warning
Be aware that this option may cause problems with async [concurrent tests](/api/test#test-concurrent). If enabled, the completion of one test will restore all the values changed with [`vi.stubEnv`](/api/vi#vi-stubenv), including those currently being used by other tests in progress.
:::
