---
title: disableConsoleIntercept | Config
outline: deep
---

# disableConsoleIntercept

- **Type:** `boolean`
- **CLI:** `--disableConsoleIntercept`
- **Default:** `false`

By default, Vitest automatically intercepts console logging during tests for extra formatting of test file, test title, etc.

This is also required for console log preview on Vitest UI.

However, disabling such interception might help when you want to debug a code with normal synchronous terminal console logging.

::: warning
This option has no effect on [browser tests](/guide/browser/) since Vitest preserves original logging in browser devtools.
:::
