# reporters

::: tip
This options is only avaialble in the top level config. You cannot specify it as an option of a [test project](/guide/projects).
:::

- **Default:** `'default'`
- **CLI:**
  - `--reporter=tap` for a single reporter
  - `--reporter=verbose --reporter=github-actions` for multiple reporters

This option defines a single reporter or a list of reporters available to Vitest during the test run. For a list of available built-in reporters, check out the ["Reporters" guide](/guide/reporters).

Alongside built-in reporters, you can also pass down a custom implementation of a [`Reporter` interface](/api/advanced/reporters), or a path to a module that exports it as a default export (e.g. `'./path/to/reporter.ts'`, `'@scope/reporter'`).

::: warning
Note that the [coverage](/guide/coverage) feature uses [`coverage.reporter`](/config/coverage#reporter) option instead of this one.
:::

## Example

```ts [vitest.config.ts]
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    reporters: [
      'default',
      // conditional reporter
      process.env.CI ? 'github-actions' : {},
      // custom reporter from npm package with options
      // are passed down as a tuple
      [
        'vitest-sonar-reporter',
        { outputFile: 'sonar-report.xml' }
      ],
    ]
  }
})
```
