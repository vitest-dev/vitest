---
title: reporters | Config
---

# reporters <CRoot /> {#reporters}

- **Type**

```ts
interface UserConfig {
  reporters?: ConfigReporter | Array<ConfigReporter>
}

type ConfigReporter = string | Reporter | [string, object?]
```

- **Default**

  [`'default'`](/guide/reporters#default-reporter)
- **CLI**
  - `--reporter=tap` for a single reporter
  - `--reporter=verbose --reporter=github-actions` for multiple reporters

This option defines a single reporter or a list of reporters available to Vitest during the test run.

Alongside built-in reporters, you can also pass down a custom implementation of a [`Reporter` interface](/api/advanced/reporters), or a path to a module that exports it as a default export (e.g. `'./path/to/reporter.ts'`, `'@scope/reporter'`).

You can configure a reporter by providing a tuple: `[string, object]`, where the string is a reporter name, and object is reporter's options.

::: warning
Note that the [coverage](/guide/coverage) feature uses a different [`coverage.reporter`](/config/coverage#reporter) option instead of this one.
:::

## Built-in Reporters

- [`default`](/guide/reporters#default-reporter)
- [`verbose`](/guide/reporters#verbose-reporter)
- [`tree`](/guide/reporters#tree-reporter)
- [`dot`](/guide/reporters#dot-reporter)
- [`junit`](/guide/reporters#junit-reporter)
- [`json`](/guide/reporters#json-reporter)
- [`html`](/guide/reporters#html-reporter)
- [`tap`](/guide/reporters#tap-reporter)
- [`tap-flat`](/guide/reporters#tap-flat-reporter)
- [`hanging-process`](/guide/reporters#hanging-process-reporter)
- [`github-actions`](/guide/reporters#github-actions-reporter)
- [`blob`](/guide/reporters#blob-reporter)

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
