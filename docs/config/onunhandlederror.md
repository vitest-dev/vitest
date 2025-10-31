---
title: onUnhandledError | Config
outline: deep
---

# onUnhandledError <CRoot /> <Version>4.0.0</Version>

- **Type:**

```ts
function onUnhandledError(
  error: (TestError | Error) & { type: string }
): boolean | void
```

A custom callback for filtering unhandled errors that should not be reported. When an error is filtered out, it no longer affects the result of the test run.

To report unhandled errors without affecting the test outcome, use the [`dangerouslyIgnoreUnhandledErrors`](/config/dangerouslyignoreunhandlederrors) option instead.

::: tip
This callback is called on the main thread, it doesn't have access to your test context.
:::

## Example

```ts
import type { ParsedStack } from 'vitest'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    onUnhandledError(error): boolean | void {
      // Ignore all errors with the name "MySpecialError".
      if (error.name === 'MySpecialError') {
        return false
      }
    },
  },
})
```
