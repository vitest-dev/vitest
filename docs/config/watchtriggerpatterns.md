---
title: watchTriggerPatterns | Config
outline: deep
---

# watchTriggerPatterns <CRoot /> <Version>3.2.0</Version>

- **Type:** `WatcherTriggerPattern[]`

Vitest reruns tests based on the module graph which is populated by static and dynamic `import` statements. However, if you are reading from the file system or fetching from a proxy, then Vitest cannot detect those dependencies.

To correctly rerun those tests, you can define a regex pattern and a function that returns a list of test files to run.

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    watchTriggerPatterns: [
      {
        pattern: /^src\/(mailers|templates)\/(.*)\.(ts|html|txt)$/,
        testsToRun: (id, match) => {
          // relative to the root value
          return `./api/tests/mailers/${match[2]}.test.ts`
        },
      },
    ],
  },
})
```

::: warning
Returned files should be either absolute or relative to the root. Note that this is a global option, and it cannot be used inside of [project](/guide/projects) configs.
:::
