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
