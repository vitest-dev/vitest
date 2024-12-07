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
  console.log(testModule.moduleId, 'results', testModule.result())
}
```

::: tip
[`TestModule`](/advanced/reporters#TestModule), [`TestSuite`](/advanced/reporters#TestSuite) and [`TestCase`](/advanced/reporters#TestCase) APIs are not experimental and follow SemVer since Vitest 2.1.
:::

## `createVitest`

`createVitest` method doesn't validate that required packages are installed. This method also doesn't respect `config.standalone` or `config.mergeReports`. Vitest also won't be closed automatically even if `watch` is disabled.

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
  // this will set process.exitCode to 1 if tests failed
  await vitest.start(['my-filter'])
}
catch (err) {
  // this can throw
  // "FilesNotFoundError" if no files were found
  // "GitNotFoundError" if `--changed` is enabled and repository is not initialized
}
finally {
  await vitest.close()
}
```
