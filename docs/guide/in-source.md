# In-source testing

Vitest also provides a way to run tests with in your source code along with the implementation, similar to [Rust's module tests](https://doc.rust-lang.org/book/ch11-03-test-organization.html#the-tests-module-and-cfgtest).

This makes the tests share the same closure as the implementations and able to test against private states without exporting. Meanwhile, it also brings the closer feedback loop for development.

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
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    includeSource: ['src/**/*.{js,ts}'],
  },
})
```

Then you can start to test!

```bash
$ npx vitest
```

## Production build

For production build, you will need to set the `define` options in your config file, letting the bundler to do the dead code elimination. For example, in Vite

```diff
// vite.config.ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
+ define: {
+   'import.meta.vitest': 'undefined',
+ },
  test: {
    includeSource: ['src/**/*.{js,ts}']
  },
})
```

### Other Bundlers

<details mt4>
<summary text-xl>unbuild</summary>

```diff
// build.config.ts
import { defineConfig } from 'unbuild'

export default defineConfig({
+ replace: {
+   'import.meta.vitest': 'undefined',
+ },
  // other options
})
```

Learn more: <a href="https://github.com/unjs/unbuild" target="_blank">unbuild</a>

</details>

<details my2>
<summary text-xl>rollup</summary>

```diff
// rollup.config.js
+ import replace from '@rollup/plugin-replace'

export default {
  plugins: [
+   replace({
+     'import.meta.vitest': 'undefined',
+   })
  ],
  // other options
}
```

Learn more: <a href="https://rollupjs.org/" target="_blank">rollup</a>

</details>

## TypeScript

To get TypeScript support for `import.meta.vitest`, add `vitest/importMeta` to your `tsconfig.json`:

```diff
// tsconfig.json
{
  "compilerOptions": {
    "types": [
+     "vitest/importMeta"
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
