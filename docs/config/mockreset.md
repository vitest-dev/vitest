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
