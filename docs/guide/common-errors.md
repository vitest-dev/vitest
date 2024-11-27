---
title: Common Errors | Guide
---

# Common Errors

## Cannot find module './relative-path'

If you receive an error that module cannot be found, it might mean several different things:

- 1. You misspelled the path. Make sure the path is correct.

- 2. It's possible that you rely on `baseUrl` in your `tsconfig.json`. Vite doesn't take into account `tsconfig.json` by default, so you might need to install [`vite-tsconfig-paths`](https://www.npmjs.com/package/vite-tsconfig-paths) yourself, if you rely on this behaviour.

```ts
import { defineConfig } from 'vitest/config'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [tsconfigPaths()]
})
```

Or rewrite your path to not be relative to root:

```diff
- import helpers from 'src/helpers'
+ import helpers from '../src/helpers'
```

- 3. Make sure you don't have relative [aliases](/config/#alias). Vite treats them as relative to the file where the import is instead of the root.

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    alias: {
      '@/': './src/', // [!code --]
      '@/': new URL('./src/', import.meta.url).pathname, // [!code ++]
    }
  }
})
```

## Cannot mock "./mocked-file.js" because it is already loaded

This error happens when `vi.mock` method is called on a module that was already loaded. Vitest throws this error because this call has no effect since cached modules are preferred.

Remember that `vi.mock` is always hoisted - it means that the module was loaded before the test file started executing - most likely in a setup file. To fix the error, remove the import or clear the cache at the end of a setup file - beware that setup file and your test file will reference different modules in that case.

```ts [setupFile.js]
import { vi } from 'vitest'
import { sideEffect } from './mocked-file.js'

sideEffect()

vi.resetModules()
```

## Failed to terminate worker

This error can happen when NodeJS's `fetch` is used with default [`pool: 'threads'`](/config/#threads). This issue is tracked on issue [Timeout abort can leave process(es) running in the background #3077](https://github.com/vitest-dev/vitest/issues/3077).

As work-around you can switch to [`pool: 'forks'`](/config/#forks) or [`pool: 'vmForks'`](/config/#vmforks).

::: code-group
```ts [vitest.config.js]
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    pool: 'forks',
  },
})
```
```bash [CLI]
vitest --pool=forks
```
:::

## Segfaults and native code errors

Running [native NodeJS modules](https://nodejs.org/api/addons.html) in `pool: 'threads'` can run into cryptic errors coming from the native code.

- `Segmentation fault (core dumped)`
- `thread '<unnamed>' panicked at 'assertion failed`
- `Abort trap: 6`
- `internal error: entered unreachable code`

In these cases the native module is likely not built to be multi-thread safe. As work-around, you can switch to `pool: 'forks'` which runs the test cases in multiple `node:child_process` instead of multiple `node:worker_threads`.

::: code-group
```ts [vitest.config.js]
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    pool: 'forks',
  },
})
```
```bash [CLI]
vitest --pool=forks
```
:::
