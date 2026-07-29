# @vitest/coverage-v8

[![NPM version](https://img.shields.io/npm/v/@vitest/coverage-v8?color=a1b858&label=)](https://npmx.dev/package/@vitest/coverage-v8)

Vitest coverage provider that supports native code coverage via [v8](https://v8.dev/blog/javascript-code-coverage).

## Installation

After installing the package, specify `v8` in the `coverage.provider` field of your Vitest configuration (or leave it empty as it is the default provider):

```ts
// vitest.config.ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
    },
  },
})
```

Then run Vitest with coverage:

```sh
npx vitest --coverage
```

[GitHub](https://github.com/vitest-dev/vitest/tree/main/packages/coverage-v8) | [Documentation](https://vitest.dev/guide/coverage)
