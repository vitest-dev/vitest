# Configuring Vitest

## Configuration

`vitest` will read your root `vite.config.ts` when it present to match with the plugins and setup as your Vite app. If you want to it to have a different configuration for testing, you could either:

- Create `vitest.config.ts`, which will have the higher priority
- Pass `--config` option to CLI, e.g. `vitest --config ./path/to/vitest.config.ts`
- Use `process.env.VITEST` to conditionally apply different configuration in `vite.config.ts`

To configure `vitest` itself, add `test` property in your Vite config

```ts
// vite.config.ts
import { defineConfig } from "vite";

export default defineConfig({
  test: {
    // ...
  },
});
```

TODO: Mention [Config File Resolving](), [Config Intellisense]()

## Options

### global

- **Type:** `boolean`
- **Default:** `false`

By default, `vitest` does not provide global APIs for explicitness. If you prefer to use the APIs globally like Jest, you can pass the `--global` option to CLI or add `global: true` in the config.

```ts
// vite.config.ts
import { defineConfig } from "vite";

export default defineConfig({
  test: {
    global: true,
  },
});
```

To get TypeScript working with the global APIs, add `vitest/global` to the `types` filed in your `tsconfig.json`

```jsonc
// tsconfig.json
{
  "compilerOptions": {
    "types": ["vitest/global"]
  }
}
```

If you are already using [`unplugin-auto-import`](https://github.com/antfu/unplugin-vue-components) in your project, you can also use it directly for auto importing those APIs.

```ts
// vite.config.ts
import { defineConfig } from "vite";
import AutoImport from "unplugin-auto-import/vite";

export default defineConfig({
  plugins: [
    AutoImport({
      imports: ["vitest"],
      dts: true, // generate TypeScript declaration
    }),
  ],
});
```
