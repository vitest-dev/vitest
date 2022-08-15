---
title: Coverage | Guide
---

# Coverage

Vitest supports Native code coverage via [`c8`](https://github.com/bcoe/c8) and instrumented code coverage via [`istanbul`](https://istanbul.js.org/).

## Coverage Providers

:::tip
Since Vitest v0.22.0
:::

Both `c8` and `istanbul` support are optional. By default, `c8` will be used.

You can select the coverage tool by setting `test.coverage.provider` to either `c8` or `istanbul`:

```ts
// vite.config.ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    coverage: {
      provider: 'istanbul' // or 'c8'
    },
  },
})
```

When you start the Vitest process, it will prompt you to install the corresponding support package automatically.

Or if you prefer to install them manually:

```bash
# For c8
npm i -D @vitest/coverage-c8

# For istanbul
npm i -D @vitest/coverage-istanbul
```

## Coverage Setup

To test with coverage enabled, you can pass the `--coverage` flag in CLI.

```json
{
  "scripts": {
    "test": "vitest",
    "coverage": "vitest run --coverage"
  }
}
```

To configure it, set `test.coverage` options in your config file:

```ts
// vite.config.ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    coverage: {
      reporter: ['text', 'json', 'html'],
    },
  },
})
```

## Custom Coverage Provider

It's also possible to provide your custom coverage provider by passing an object to the `test.coverage.provider`:

```ts
// vite.config.ts
import { defineConfig } from 'vitest/config'
import CustomCoverageProvider from 'my-custom-coverage-provider'

export default defineConfig({
  test: {
    coverage: {
      provider: CustomCoverageProvider()
    },
  },
})
```

Please refer to the type definition for more details.
