---
title: mockReset | Config
outline: deep
---

# mockReset

- **Type:** `boolean`
- **Default:** `false`

Should Vitest automatically call [`vi.resetAllMocks()`](/api/vi#vi-resetallmocks) before each test.

This will clear mock history and reset each implementation.

```js [vitest.config.js]
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    mockReset: true,
  },
})
```

::: warning
Be aware that this option may cause problems with async [concurrent tests](/api/test#test-concurrent). If enabled, the completion of one test will clear the mock history and implementation for all mocks, including those currently being used by other tests in progress.
:::
