---
title: server | Config
outline: deep
---

# server <Deprecated />

Before Vitest 4, this option was used to define the configuration for the `vite-node` server.

At the moment, this option allows you to configure the inlining and externalization mechanisms, along with the module runner debugging configuration.

::: warning
These options should be used only as the last resort to improve performance by externalizing auto-inlined dependencies or to fix issues by inlining invalid external dependencies.

Normally, Vitest should do this automatically.
:::

## deps

### external

- **Type:** `(string | RegExp)[]`
- **Default:** files inside [`moduleDirectories`](/config/deps#moduledirectories)

Specifies modules that should not be transformed by Vite and should instead be processed directly by the engine. These modules are imported via native dynamic `import` and bypass both transformation and resolution phases.

```js [vitest.config.js]
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    server: {
      deps: {
        external: ['react'],
      },
    },
  },
})
```

External modules and their dependencies are not present in the module graph and will not trigger test restarts when they change.

Typically, packages under `node_modules` are externalized.

::: tip
If a string is provided, it is first normalized by prefixing the `/node_modules/` or other [`moduleDirectories`](/config/deps#moduledirectories) segments (for example, `'react'` becomes `/node_modules/react/`), and the resulting string is then matched against the full file path. For example, package `@company/some-name` located inside `packages/some-name` should be specified as `some-name`, and `packages` should be included in `deps.moduleDirectories`.

If a `RegExp` is provided, it is matched against the full file path.
:::

### inline

- **Type:** `(string | RegExp)[] | true`
- **Default:** everything that is not externalized

Specifies modules that should be transformed and resolved by Vite. These modules are run by Vite's [module runner](https://vite.dev/guide/api-environment-runtimes#modulerunner).

Typically, your source files are inlined.

::: tip
If a string is provided, it is first normalized by prefixing the `/node_modules/` or other [`moduleDirectories`](/config/deps#moduledirectories) segments (for example, `'react'` becomes `/node_modules/react/`), and the resulting string is then matched against the full file path. For example, package `@company/some-name` located inside `packages/some-name` should be specified as `some-name`, and `packages` should be included in `deps.moduleDirectories`.

If a `RegExp` is provided, it is matched against the full file path.
:::

### fallbackCJS

- **Type:** `boolean`
- **Default:** `false`

When a dependency is a valid ESM package, try to guess the cjs version based on the path. This might be helpful, if a dependency has the wrong ESM file.

This might potentially cause some misalignment if a package has different logic in ESM and CJS mode.

## debug

### dump

- **Type:** `string | boolean`
- **Default:** `false`

The folder where Vitest stores the contents of inlined test files that can be inspected manually.

If set to `true`, Vitest dumps the files inside the `.vitest-dump` folder relative to the root of the project.

You can also use `VITEST_DEBUG_DUMP` env variable to enable this conditionally.

### load

- **Type:** `boolean`
- **Default:** `false`

Read files from the dump instead of transforming them. If dump is disabled, this does nothing.

You can also use `VITEST_DEBUG_LOAD_DUMP` env variable to enable this conditionally.
