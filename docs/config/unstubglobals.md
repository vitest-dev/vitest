---
title: unstubGlobals | Config
outline: deep
---

# unstubGlobals

- **Type:** `boolean`
- **Default:** `false`

Should Vitest automatically call [`vi.unstubAllGlobals()`](/api/vi#vi-unstuballglobals) before each test.

```js [vitest.config.js]
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    unstubGlobals: true,
  },
})
```
