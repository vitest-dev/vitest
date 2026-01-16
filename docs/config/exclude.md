---
title: exclude | Config
---

# exclude

- **Type:** `string[]`
- **Default:** `['**/node_modules/**', '**/.git/**']`
- **CLI:** `vitest --exclude "**/excluded-file" --exclude "*/other-files/*.js"`

A list of [glob patterns](https://superchupu.dev/tinyglobby/comparison) that should be excluded from your test files. These patterns are resolved relative to the [`root`](/config/root) ([`process.cwd()`](https://nodejs.org/api/process.html#processcwd) by default).

Vitest uses the [`tinyglobby`](https://www.npmjs.com/package/tinyglobby) package to resolve the globs.

::: warning
This option does not affect coverage. If you need to remove certain files from the coverage report, use [`coverage.exclude`](/config/coverage#exclude).

This is the only option that doesn't override your configuration if you provide it with a CLI flag. All glob patterns added via `--exclude` flag will be added to the config's `exclude`.
:::

## Example

```js
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      './temp/**',
    ],
  },
})
```

::: tip
Although the CLI `exclude` option is additive, manually setting `exclude` in your config will replace the default value. To extend the default `exclude` patterns, use `configDefaults` from `vitest/config`:

```js{6}
import { configDefaults, defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    exclude: [
      ...configDefaults.exclude,
      'packages/template/*',
      './temp/**',
    ],
  },
})
```
:::
