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
