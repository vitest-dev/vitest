---
title: globals | Config
---

# globals

- **Type:** `boolean`
- **Default:** `false`
- **CLI:** `--globals`, `--no-globals`, `--globals=false`

By default, `vitest` does not provide global APIs for explicitness. If you prefer to use the APIs globally like Jest, you can pass the `--globals` option to CLI or add `globals: true` in the config.

```js
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
  },
})
```

::: tip
Note that some libraries, e.g., `@testing-library/react`, rely on globals being present to perform auto cleanup.
:::

To get TypeScript working with the global APIs, add `vitest/globals` to the `types` field in your `tsconfig.json`:

```json [tsconfig.json]
{
  "compilerOptions": {
    "types": ["vitest/globals"]
  }
}
```

If you have redefined your [`typeRoots`](https://www.typescriptlang.org/tsconfig/#typeRoots) to include additional types in your compilation, you will need to add back the `node_modules` to make `vitest/globals` discoverable:

```json [tsconfig.json]
{
  "compilerOptions": {
    "typeRoots": ["./types", "./node_modules/@types", "./node_modules"],
    "types": ["vitest/globals"]
  }
}
```
