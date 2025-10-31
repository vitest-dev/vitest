---
title: dangerouslyIgnoreUnhandledErrors | Config
outline: deep
---

# dangerouslyIgnoreUnhandledErrors <CRoot />

- **Type**: `boolean`
- **Default**: `false`
- **CLI:**
  - `--dangerouslyIgnoreUnhandledErrors`
  - `--dangerouslyIgnoreUnhandledErrors=false`

If this option is set to `true`, Vitest will not fail the test run if there are unhandled errors. Note that built-in reporters will still report them.

If you want to filter out certain errors conditionally, use [`onUnhandledError`](/config/onunhandlederror) callback instead.

## Example

```js [vitest.config.js]
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    dangerouslyIgnoreUnhandledErrors: true,
  },
})
```
