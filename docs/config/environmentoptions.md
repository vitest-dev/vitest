---
title: environmentOptions | Config
---

# environmentOptions

- **Type:** `Record<'jsdom' | 'happyDOM' | string, unknown>`
- **Default:** `{}`

These options are passed to the setup method of the current [environment](/config/environment). By default, you can configure options only for `jsdom` and `happyDOM` when you use them as your test environment.

## Example

```js [vitest.config.js]
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environmentOptions: {
      jsdom: {
        url: 'http://localhost:3000',
      },
      happyDOM: {
        width: 300,
        height: 400,
      },
    },
  },
})
```

::: warning
Options are scoped to their environment. For example, put jsdom options under the `jsdom` key and happy-dom options under the `happyDOM` key. This lets you mix multiple environments within the same project.
:::
