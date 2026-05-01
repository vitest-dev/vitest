---
title: Common Errors | Guide
---

# Common Errors

## Cannot find module './relative-path'

If you receive an error that module cannot be found, it might mean several different things:

1. You misspelled the path. Make sure the path is correct.

2. It's possible that you rely on `baseUrl` in your `tsconfig.json`. Vite doesn't take into account `tsconfig.json` by default, so you might need to install [`vite-tsconfig-paths`](https://npmx.dev/package/vite-tsconfig-paths) yourself, if you rely on this behavior.

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

## Unhandled Promise Rejection

This error happens when a Promise rejects but no `.catch()` handler or `await` is attached to it before the microtask queue flushes. This behavior comes from JavaScript itself and is not specific to Vitest. Learn more in the [Node.js documentation](https://nodejs.org/api/process.html#event-unhandledrejection).

A common cause is calling an async function without `await`ing it:

```ts
async function fetchUser(id) {
  const res = await fetch(`/api/users/${id}`)
  if (!res.ok) {
    throw new Error(`User ${id} not found`) // [!code highlight]
  }
  return res.json()
}

test('fetches user', async () => {
  fetchUser(123) // [!code error]
})
```

Because `fetchUser()` is not `await`ed, its rejection has no handler and Vitest reports:

```
Unhandled Rejection: Error: User 123 not found
```

### Fix

`await` the promise so Vitest can catch the error:

```ts
test('fetches user', async () => {
  await fetchUser(123) // [!code ++]
})
```

If you expect the call to throw, use [`expect().rejects`](/api/expect#rejects):

```ts
test('rejects for missing user', async () => {
  await expect(fetchUser(123)).rejects.toThrow('User 123 not found')
})
```

## Package fails to load in Vitest but works in your app

Some packages work in an app build but fail in Vitest because they are only valid after a bundler has rewritten or resolved them. When Vitest externalizes a dependency, Node.js loads it directly, so Node's ESM and package rules apply. See Node.js documentation on [ECMAScript modules](https://nodejs.org/docs/latest/api/esm.html) and [packages](https://nodejs.org/docs/latest/api/packages.html) for the precise rules.

Common examples include packages that:

- ship ESM syntax in `.js` files without `"type": "module"`
- use extensionless relative imports in ESM files
- have incorrect `exports`, `imports`, `main`, or `module` entries
- mix CommonJS and ESM entry points in a way that only works after bundling
- import CSS or other non-JavaScript files that are expected to be handled by a bundler

You might see errors such as:

- `Cannot find module './relative-path' imported from ...`
- `Unexpected token 'export'`
- `Must use import to load ES Module`
- `Module ... seems to be an ES Module but shipped in a CommonJS package.`
- `Unknown file extension ".css"`

When possible, fix the package so Node.js can load it directly: add `"type": "module"` for ESM `.js` files, use `.mjs`, include explicit file extensions in ESM imports, and make sure `exports` points to files Node.js can load.

If you cannot fix the package itself, inline it so Vite handles it instead of passing it to Node.js as an external dependency. Inline the whole dependency chain that leads to the invalid package. If your source imports `wrapper-package`, and `wrapper-package` imports `broken-package`, inline both packages:

```ts [vitest.config.js]
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    server: {
      deps: {
        inline: ['wrapper-package', 'broken-package'],
      },
    },
  },
})
```

You can also use Vite's [`ssr.resolve.noExternal`](https://vite.dev/config/ssr-options#ssr-resolve-noexternal) for the same purpose. Vitest merges `ssr.resolve.noExternal` into [`server.deps.inline`](/config/server#server-deps-inline), so this is useful when the dependency also needs to be bundled by Vite in SSR builds:

```ts [vitest.config.js]
import { defineConfig } from 'vitest/config'

export default defineConfig({
  ssr: {
    resolve: {
      noExternal: ['wrapper-package', 'broken-package'],
    },
  },
})
```
