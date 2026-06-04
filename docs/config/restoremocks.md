---
title: restoreMocks | Config
outline: deep
---

# restoreMocks

- **Type:** `boolean`
- **Default:** `false`

Should Vitest automatically call [`vi.restoreAllMocks()`](/api/vi#vi-restoreallmocks) before each test.

This restores all original implementations on spies created manually with [`vi.spyOn`](/api/vi#vi-spyon).

```js [vitest.config.js]
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    restoreMocks: true,
  },
})
```

::: warning
Be aware that this option may cause problems with async [concurrent tests](/api/test#test-concurrent). If enabled, the completion of one test will restore the implementation for all spies, including those currently being used by other tests in progress.
:::
