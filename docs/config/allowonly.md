---
title: allowOnly | Config
outline: deep
---

# allowOnly

- **Type**: `boolean`
- **Default**: `!process.env.CI`
- **CLI:** `--allowOnly`, `--allowOnly=false`

By default, Vitest does not permit tests marked with the [`only`](/api/test#test-only) flag in Continuous Integration (CI) environments. Conversely, in local development environments, Vitest allows these tests to run.

::: info
Vitest uses [`std-env`](https://www.npmjs.com/package/std-env) package to detect the environment.
:::

You can customize this behavior by explicitly setting the `allowOnly` option to either `true` or `false`.

::: code-group
```js [vitest.config.js]
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    allowOnly: true,
  },
})
```
```bash [CLI]
vitest --allowOnly
```
:::

When enabled, Vitest will not fail the test suite if tests marked with [`only`](/api/test#test-only) are detected, including in CI environments.

When disabled, Vitest will fail the test suite if tests marked with [`only`](/api/test#test-only) are detected, including in local development environments.
