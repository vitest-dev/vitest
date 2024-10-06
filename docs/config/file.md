---
outline: deep
---

# Managing Vitest config file

If you are using Vite and have a `vite.config` file, Vitest will read it to match with the plugins and setup as your Vite app. If you want to have a different configuration for testing or your main app doesn't rely on Vite specifically, you could either:

- Create `vitest.config.ts`, which will have the higher priority and will **override** the configuration from `vite.config.ts` (Vitest supports all conventional JS and TS extensions, but doesn't support `json`) - it means all options in your `vite.config` will be **ignored**
- Pass `--config` option to CLI, e.g. `vitest --config ./path/to/vitest.config.ts`
- Use `process.env.VITEST` or `mode` property on `defineConfig` (will be set to `test`/`benchmark` if not overridden with `--mode`) to conditionally apply different configuration in `vite.config.ts`

To configure `vitest` itself, add `test` property in your Vite config. You'll also need to add a reference to Vitest types using a [triple slash command](https://www.typescriptlang.org/docs/handbook/triple-slash-directives.html#-reference-types-) at the top of your config file, if you are importing `defineConfig` from `vite` itself.

Using `defineConfig` from `vite` you should follow this:

```ts
/// <reference types="vitest" />
import { defineConfig } from 'vite'

export default defineConfig({
  test: {
    // ... Specify options here.
  },
})
```

The `<reference types="vitest" />` will stop working in Vitest 3, but you can start migrating to `vitest/config` in Vitest 2.1:

```ts
/// <reference types="vitest/config" />
import { defineConfig } from 'vite'

export default defineConfig({
  test: {
    // ... Specify options here.
  },
})
```

Using `defineConfig` from `vitest/config` you should follow this:

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // ... Specify options here.
  },
})
```

You can retrieve Vitest's default options to expand them if needed:

```ts
import { configDefaults, defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    exclude: [...configDefaults.exclude, 'packages/template/*'],
  },
})
```

When using a separate `vitest.config.js`, you can also extend Vite's options from another config file if needed:

```ts
import { defineConfig, mergeConfig } from 'vitest/config'
import viteConfig from './vite.config'

export default mergeConfig(viteConfig, defineConfig({
  test: {
    exclude: ['packages/template/*'],
  },
}))
```

If your Vite config is defined as a function, you can define the config like this:

```ts
import { defineConfig, mergeConfig } from 'vitest/config'
import viteConfig from './vite.config'

export default defineConfig(configEnv => mergeConfig(
  viteConfig(configEnv),
  defineConfig({
    test: {
      exclude: ['packages/template/*'],
    },
  })
))
```
