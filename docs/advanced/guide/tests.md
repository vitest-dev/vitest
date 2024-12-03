# Running Tests

::: warning
This guide explains how to use the advanced API to run tests via a Node.js script. If you just want to [run tests](/guide/), you probably don't need this. It is primarily used by library authors.

Breaking changes might not follow SemVer, please pin Vitest's version when using the experimental API.
:::

Vitest exposes two methods to initiate Vitest:

- `startVitest` initiates Vitest, validates the packages are installed and runs tests immidiatly
- `createVitest` only initiates Vitest and doesn't run any tests

## `startVitest`

```ts
import { startVitest } from 'vitest/node'

const vitest = await startVitest(
  'test',
  [], // CLI filters
  {}, // override test config
  {}, // override Vite config
  {}, // custom Vitest options
)
const testModules = vitest.state.getTestModules()
for (const testModule of testModules) {
  console.log(testModule.moduleId, testModule.ok() ? 'passed' : 'failed')
}
```

::: tip
[`TestModule`](/advanced/api/test-module), [`TestSuite`](/advanced/api/test-suite) and [`TestCase`](/advanced/api/test-case) APIs are not experimental and follow SemVer since Vitest 2.1.
:::

## `createVitest`

Creates a [Vitest](/advanced/api/vitest) instances without running tests.

`createVitest` method doesn't validate that required packages are installed. It also doesn't respect `config.standalone` or `config.mergeReports`. Vitest won't be closed automatically even if `watch` is disabled.

```ts
import { createVitest } from 'vitest/node'

const vitest = await createVitest(
  'test',
  {}, // override test config
  {}, // override Vite config
  {}, // custom Vitest options
)

// called when `vitest.cancelCurrentRun()` is invoked
vitest.onCancel(() => {})
// called during `vitest.close()` call
vitest.onClose(() => {})
// called when Vitest reruns test files
vitest.onTestsRerun((files) => {})

try {
  // this will set process.exitCode to 1 if tests failed,
  // and won't close the process automatically
  await vitest.start(['my-filter'])
}
catch (err) {
  // this can throw
  // "FilesNotFoundError" if no files were found
  // "GitNotFoundError" with `--changed` and repository is not initialized
}
finally {
  await vitest.close()
}
```
