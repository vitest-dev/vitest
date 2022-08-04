---
title: Coverage | Guide
---

# Coverage

Vitest supports Native code coverage via [`c8`](https://github.com/bcoe/c8) and instrumented code coverage via [`istanbul`](https://istanbul.js.org/).

`c8` and `istanbul`-packages are optional peer dependencies, to use the coverage feature you will need to install these first by:

```bash
# For c8
npm i -D c8

# For istanbul, TODO: replace with `@vitest/coverage-istanbul` or similar package
npm i -D istanbul-lib-coverage istanbul-lib-instrument istanbul-lib-report istanbul-lib-source-maps istanbul-reports
```

Then you could get the coverage by passing the `--coverage` flag in CLI.

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

You can select the coverage tool by setting `test.coverage.provider` to either `c8` or `istanbul`:

```ts
// vite.config.ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    coverage: {
      provider: 'istanbul',
    },
  },
})
```
