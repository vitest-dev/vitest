---
title: include | Config
---

# include

- **Type:** `string[]`
- **Default:** `['**/*.{test,spec}.?(c|m)[jt]s?(x)']`
- **CLI:** `vitest [...include]`, `vitest **/*.test.js`

A list of [glob patterns](https://superchupu.dev/tinyglobby/comparison) that match your test files. These patterns are resolved relative to the [`root`](/config/root) ([`process.cwd()`](https://nodejs.org/api/process.html#processcwd) by default).

Vitest uses the [`tinyglobby`](https://www.npmjs.com/package/tinyglobby) package to resolve the globs.

::: tip NOTE
When using coverage, Vitest automatically adds test files `include` patterns to coverage's default `exclude` patterns. See [`coverage.exclude`](/config/coverage#exclude).
:::

## Example

```js
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: [
      './test',
      './**/*.{test,spec}.tsx?',
    ],
  },
})
```

Vitest provides reasonable defaults, so normally you wouldn't override them. A good example of defining `include` is for [test projects](/guide/projects):

```js{8,12} [vitest.config.js]
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'unit',
          include: ['./test/unit/*.test.js'],
        },
      },
      {
        test: {
          name: 'e2e',
          include: ['./test/e2e/*.test.js'],
        },
      },
    ],
  },
})
```

::: warning
This option will override Vitest defaults. If you just want to extend them, use `configDefaults` from `vitest/config`:

```js{6}
import { configDefaults, defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: [
      ...configDefaults.include,
      './test',
      './**/*.{test,spec}.tsx?',
    ],
  },
})
```
:::
