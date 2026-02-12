---
title: Common Errors | Guide
---

# Common Errors

## Cannot find module './relative-path'

If you receive an error that module cannot be found, it might mean several different things:

1. You misspelled the path. Make sure the path is correct.

2. It's possible that you rely on `baseUrl` in your `tsconfig.json`. Vite doesn't take into account `tsconfig.json` by default, so you might need to install [`vite-tsconfig-paths`](https://www.npmjs.com/package/vite-tsconfig-paths) yourself, if you rely on this behavior.

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

3. Make sure you don't have relative [aliases](/config/alias). Vite treats them as relative to the file where the import is instead of the root.

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

## Failed to Terminate Worker

This error can happen when NodeJS's `fetch` is used with [`pool: 'threads'`](/config/pool#threads). See [#3077](https://github.com/vitest-dev/vitest/issues/3077) for details.

The default [`pool: 'forks'`](/config/pool#forks) does not have this issue. If you've explicitly set `pool: 'threads'`, switching back to `'forks'` or using [`'vmForks'`](/config/pool#vmforks) will resolve it.

## Custom package conditions are not resolved

If you are using custom conditions in your `package.json` [exports](https://nodejs.org/api/packages.html#package-entry-points) or [subpath imports](https://nodejs.org/api/packages.html#subpath-imports), you may find that Vitest does not respect these conditions by default.

For example, if you have the following in your `package.json`:

```json
{
  "exports": {
    ".": {
      "custom": "./lib/custom.js",
      "import": "./lib/index.js"
    }
  },
  "imports": {
    "#internal": {
      "custom": "./src/internal.js",
      "default": "./lib/internal.js"
    }
  }
}
```

By default, Vitest will only use the `import` and `default` conditions. To make Vitest respect custom conditions, you need to configure [`ssr.resolve.conditions`](https://vite.dev/config/ssr-options#ssr-resolve-conditions) in your Vitest config:

```ts [vitest.config.js]
import { defineConfig } from 'vitest/config'

export default defineConfig({
  ssr: {
    resolve: {
      conditions: ['custom', 'import', 'default'],
    },
  },
})
```

::: tip Why `ssr.resolve.conditions` and not `resolve.conditions`?
Vitest follows Vite's configuration convention:
- [`resolve.conditions`](https://vite.dev/config/shared-options#resolve-conditions) applies to Vite's `client` environment, which corresponds to Vitest's browser mode, jsdom, happy-dom, or custom environments with `viteEnvironment: 'client'`.
- [`ssr.resolve.conditions`](https://vite.dev/config/ssr-options#ssr-resolve-conditions) applies to Vite's `ssr` environment, which corresponds to Vitest's node environment or custom environments with `viteEnvironment: 'ssr'`.

Since Vitest defaults to the `node` environment (which uses `viteEnvironment: 'ssr'`), module resolution uses `ssr.resolve.conditions`. This applies to both package exports and subpath imports.

You can learn more about Vite environments and Vitest environments in [`environment`](/config/environment).
:::

## Segfaults and Native Code Errors

Running [native NodeJS modules](https://nodejs.org/api/addons.html) in `pool: 'threads'` can run into cryptic errors coming from the native code.

- `Segmentation fault (core dumped)`
- `thread '<unnamed>' panicked at 'assertion failed`
- `Abort trap: 6`
- `internal error: entered unreachable code`

In these cases the native module is likely not built to be multi-thread safe. As a workaround, you can switch to `pool: 'forks'` which runs the test cases in multiple `node:child_process` instead of multiple `node:worker_threads`.

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
