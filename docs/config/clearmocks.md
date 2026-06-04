---
title: clearMocks | Config
outline: deep
---

# clearMocks

- **Type:** `boolean`
- **Default:** `false`

Should Vitest automatically call [`vi.clearAllMocks()`](/api/vi#vi-clearallmocks) before each test.

This will clear mock history without affecting mock implementations.

```js [vitest.config.js]
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    clearMocks: true,
  },
})
```

::: warning
Be aware that this option may cause problems with async [concurrent tests](/api/test#test-concurrent). If enabled, the completion of one test will clear the mock history for all mocks, including those currently being used by other tests in progress.
:::
