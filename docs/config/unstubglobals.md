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

::: warning
Be aware that this option may cause problems with async concurrent tests. If enabled, the completion of one test will restore all global values that were changed with `vi.stubGlobal`, including those currently being used by other tests in progress.
:::
