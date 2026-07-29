# @vitest/coverage-istanbul

[![NPM version](https://img.shields.io/npm/v/@vitest/coverage-istanbul?color=a1b858&label=)](https://npmx.dev/package/@vitest/coverage-istanbul)

Vitest coverage provider that instruments code coverage via [istanbul](https://istanbul.js.org/).

## Installation

After installing the package, specify `istanbul` in the `coverage.provider` field of your Vitest configuration:

```ts
// vitest.config.ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    coverage: {
      provider: 'istanbul',
    },
  },
})
```

Then run Vitest with coverage:

```sh
npx vitest --coverage
```

[GitHub](https://github.com/vitest-dev/vitest/tree/main/packages/coverage-istanbul) | [Documentation](https://vitest.dev/guide/coverage)
