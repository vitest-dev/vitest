---
title: includeSource | Config
---

# includeSource

- **Type:** `string[]`
- **Default:** `[]`

A list of [glob patterns](https://superchupu.dev/tinyglobby/comparison) that match your [in-source test files](/guide/in-source). These patterns are resolved relative to the [`root`](/config/root) ([`process.cwd()`](https://nodejs.org/api/process.html#processcwd) by default).

When defined, Vitest will run all matched files that have `import.meta.vitest` inside.

::: warning
Vitest performs a simple text-based inclusion check on source files. If a file contains `import.meta.vitest`, even in a comment, it will be matched as an in-source test file.
:::

Vitest uses the [`tinyglobby`](https://www.npmjs.com/package/tinyglobby) package to resolve the globs.

## Example

```js
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    includeSource: ['src/**/*.{js,ts}'],
  },
})
```

Then you can write tests inside your source files:

```ts [src/index.ts]
export function add(...args: number[]) {
  return args.reduce((a, b) => a + b, 0)
}

// #region in-source test suites
if (import.meta.vitest) {
  const { it, expect } = import.meta.vitest
  it('add', () => {
    expect(add()).toBe(0)
    expect(add(1)).toBe(1)
    expect(add(1, 2, 3)).toBe(6)
  })
}
// #endregion
```

For your production build, you need to replace the `import.meta.vitest` with `undefined`, letting the bundler do the dead code elimination.

::: code-group
```js [vite.config.ts]
import { defineConfig } from 'vite'

export default defineConfig({
  define: { // [!code ++]
    'import.meta.vitest': 'undefined', // [!code ++]
  }, // [!code ++]
})
```
```js [rolldown.config.js]
import { defineConfig } from 'rolldown/config'

export default defineConfig({
  transform: {
    define: { // [!code ++]
      'import.meta.vitest': 'undefined', // [!code ++]
    }, // [!code ++]
  },
})
```
```js [rollup.config.js]
import replace from '@rollup/plugin-replace' // [!code ++]

export default {
  plugins: [
    replace({ // [!code ++]
      'import.meta.vitest': 'undefined', // [!code ++]
    }) // [!code ++]
  ],
  // other options
}
```
```js [build.config.js]
import { defineBuildConfig } from 'unbuild'

export default defineBuildConfig({
  replace: { // [!code ++]
    'import.meta.vitest': 'undefined', // [!code ++]
  }, // [!code ++]
  // other options
})
```
```js [webpack.config.js]
const webpack = require('webpack')

module.exports = {
  plugins: [
    new webpack.DefinePlugin({ // [!code ++]
      'import.meta.vitest': 'undefined', // [!code ++]
    })// [!code ++]
  ],
}
```
:::

::: tip
To get TypeScript support for `import.meta.vitest`, add `vitest/importMeta` to your `tsconfig.json`:

```json [tsconfig.json]
{
  "compilerOptions": {
    "types": ["vitest/importMeta"]
  }
}
```
:::
