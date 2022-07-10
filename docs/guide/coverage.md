# Coverage

Vitest supports Native code coverage via [`c8`](https://github.com/bcoe/c8). `c8` is an optional peer dependency, to use the coverage feature you will need to install it first by:

```bash
npm i -D c8
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
