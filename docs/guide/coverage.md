---
title: Coverage | Guide
---

# Coverage

Vitest supports Native code coverage via [`v8`](https://v8.dev/blog/javascript-code-coverage) and instrumented code coverage via [`istanbul`](https://istanbul.js.org/).

## Coverage Providers

:::tip
Since Vitest v0.22.0
:::

Both `v8` and `istanbul` support are optional. By default, `v8` will be used.

You can select the coverage tool by setting `test.coverage.provider` to `v8` or `istanbul`:

```ts
// vitest.config.ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    coverage: {
      provider: 'istanbul' // or 'v8'
    },
  },
})
```

When you start the Vitest process, it will prompt you to install the corresponding support package automatically.

Or if you prefer to install them manually:

```bash
# For v8
npm i -D @vitest/coverage-v8

# For istanbul
npm i -D @vitest/coverage-istanbul
```

## Coverage Setup

To test with coverage enabled, you can pass the `--coverage` flag in CLI.
By default, reporter `['text', 'html', 'clover', 'json']` will be used.

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
// vitest.config.ts
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

It's also possible to provide your custom coverage provider by passing `'custom'` in `test.coverage.provider`:

```ts
// vitest.config.ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    coverage: {
      provider: 'custom',
      customProviderModule: 'my-custom-coverage-provider'
    },
  },
})
```

The custom providers require a `customProviderModule` option which is a module name or path where to load the `CoverageProviderModule` from. It must export an object that implements `CoverageProviderModule` as default export:

```ts
// my-custom-coverage-provider.ts
import type { CoverageProvider, CoverageProviderModule, ResolvedCoverageOptions, Vitest } from 'vitest'

const CustomCoverageProviderModule: CoverageProviderModule = {
  getProvider(): CoverageProvider {
    return new CustomCoverageProvider()
  },

  // Implements rest of the CoverageProviderModule ...
}

class CustomCoverageProvider implements CoverageProvider {
  name = 'custom-coverage-provider'
  options!: ResolvedCoverageOptions

  initialize(ctx: Vitest) {
    this.options = ctx.config.coverage
  }

  // Implements rest of the CoverageProvider ...
}

export default CustomCoverageProviderModule
```

Please refer to the type definition for more details.

## Changing the default coverage folder location

When running a coverage report, a `coverage` folder is created in the root directory of your project. If you want to move it to a different directory, use the `test.coverage.reportsDirectory` property in the `vite.config.js` file.

```js
import { defineConfig } from 'vite'

export default defineConfig({
  test: {
    coverage: {
      reportsDirectory: './tests/unit/coverage'
    }
  }
})
```

## Ignoring code

Both coverage providers have their own ways how to ignore code from coverage reports:

- [`v8`](https://github.com/istanbuljs/v8-to-istanbul#ignoring-uncovered-lines)
- [`ìstanbul`](https://github.com/istanbuljs/nyc#parsing-hints-ignoring-lines)

When using TypeScript the source codes are transpiled using `esbuild`, which strips all comments from the source codes ([esbuild#516](https://github.com/evanw/esbuild/issues/516)).
Comments which are considered as [legal comments](https://esbuild.github.io/api/#legal-comments) are preserved.

For `istanbul` provider you can include a `@preserve` keyword in the ignore hint.
Beware that these ignore hints may now be included in final production build as well.

```diff
-/* istanbul ignore if */
+/* istanbul ignore if -- @preserve */
if (condition) {
```

For `v8` this does not cause any issues. You can use `v8 ignore` comments with Typescript as usual:

<!-- eslint-skip -->
```ts
/* v8 ignore next 3 */
if (condition) {
```

## Other Options

To see all configurable options for coverage, see the [coverage Config Reference](https://vitest.dev/config/#coverage).

## Vitest UI

Since Vitest 0.31.0, you can check your coverage report in [Vitest UI](./ui).

Vitest UI will enable coverage report when it is enabled explicitly and the html coverage reporter is present, otherwise it will not be available:
- enable `coverage.enabled=true` in your configuration or run Vitest with `--coverage.enabled=true` flag
- add `html` to the `coverage.reporter` list: you can also enable `subdir` option to put coverage report in a subdirectory

<img alt="html coverage activation in Vitest UI" img-light src="/vitest-ui-show-coverage-light.png">
<img alt="html coverage activation in Vitest UI" img-dark src="/vitest-ui-show-coverage-dark.png">

<img alt="html coverage in Vitest UI" img-light src="/vitest-ui-coverage-light.png">
<img alt="html coverage in Vitest UI" img-dark src="/vitest-ui-coverage-dark.png">
