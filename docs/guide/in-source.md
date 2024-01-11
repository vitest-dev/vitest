---
title: In-Source Testing | Guide
---

# In-Source Testing

Vitest also provides a way to run tests within your source code along side the implementation, similar to [Rust's module tests](https://doc.rust-lang.org/book/ch11-03-test-organization.html#the-tests-module-and-cfgtest).

This makes the tests share the same closure as the implementations and able to test against private states without exporting. Meanwhile, it also brings a closer feedback loop for development.

## Setup

To get started, put a `if (import.meta.vitest)` block at the end of your source file and write some tests inside it. For example:

```ts
// src/index.ts

// the implementation
export function add(...args: number[]) {
  return args.reduce((a, b) => a + b, 0)
}

// in-source test suites
if (import.meta.vitest) {
  const { it, expect } = import.meta.vitest
  it('add', () => {
    expect(add()).toBe(0)
    expect(add(1)).toBe(1)
    expect(add(1, 2, 3)).toBe(6)
  })
}
```

Update the `includeSource` config for Vitest to grab the files under `src/`:

```ts
// vite.config.ts
/// <reference types="vitest" />
import { defineConfig } from 'vite'

export default defineConfig({
  test: {
    includeSource: ['src/**/*.{js,ts}'], // [!code ++]
  },
})
```

Then you can start to test!

```bash
$ npx vitest
```

## Production Build

For the production build, you will need to set the `define` options in your config file, letting the bundler do the dead code elimination. For example, in Vite

```ts
// vite.config.ts
/// <reference types="vitest" />
import { defineConfig } from 'vite'

export default defineConfig({
  test: {
    includeSource: ['src/**/*.{js,ts}'],
  },
  define: { // [!code ++]
    'import.meta.vitest': 'undefined', // [!code ++]
  }, // [!code ++]
})
```

### Other Bundlers

<details mt4>
<summary text-xl>unbuild</summary>

```ts
// build.config.ts
import { defineBuildConfig } from 'unbuild'

export default defineBuildConfig({
  replace: { // [!code ++]
    'import.meta.vitest': 'undefined', // [!code ++]
  }, // [!code ++]
  // other options
})
```

Learn more: <a href="https://github.com/unjs/unbuild" target="_blank">unbuild</a>

</details>

<details my2>
<summary text-xl>Rollup</summary>

```ts
// rollup.config.js
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

Learn more: <a href="https://rollupjs.org/" target="_blank">Rollup</a>

</details>

## TypeScript

To get TypeScript support for `import.meta.vitest`, add `vitest/importMeta` to your `tsconfig.json`:

```json
// tsconfig.json
{
  "compilerOptions": {
    "types": [
      "vitest/importMeta" // [!code ++]
    ]
  }
}
```

Reference to [`test/import-meta`](https://github.com/vitest-dev/vitest/tree/main/test/import-meta) for the full example.

## Notes

This feature could be useful for:

- Unit testing for small-scoped functions or utilities
- Prototyping
- Inline Assertion

It's recommended to **use separate test files instead** for more complex tests like components or E2E testing.
