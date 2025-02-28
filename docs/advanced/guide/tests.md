# Running Tests

::: warning
This guide explains how to use the advanced API to run tests via a Node.js script. If you just want to [run tests](/guide/), you probably don't need this. It is primarily used by library authors.

Breaking changes might not follow SemVer, please pin Vitest's version when using the experimental API.
:::

Vitest exposes two methods to initiate Vitest:

- `startVitest` initiates Vitest, validates the packages are installed and runs tests immediately
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

If you intend to keep the `Vitest` instance, make sure to at least call [`init`](/advanced/api/vitest#init). This will initialise reporters and the coverage provider, but won't run any tests. It is also recommended to enable the `watch` mode even if you don't intend to use the Vitest watcher, but want to keep the instance running. Vitest relies on this flag for some of its features to work correctly in a continous process.

After reporters are initialised, use [`runTestSpecifications`](/advanced/api/vitest#runtestspecifications) or [`rerunTestSpecifications`](/advanced/api/vitest#reruntestspecifications) to run tests if manual run is required:

```ts
watcher.on('change', async (file) => {
  const specifications = vitest.getModuleSpecifications(file)
  if (specifications.length) {
    vitest.invalidateFile(file)
    // you can use runTestSpecifications if "reporter.onWatcher*" hooks
    // should not be invoked
    await vitest.rerunTestSpecifications(specifications)
  }
})
```

::: warning
The example above shows a potential usecase if you disable the default watcher behaviour. By default, Vitest already reruns tests if files change.

Also note that `getModuleSpecifications` will not resolve test files unless they were already processed by `globTestSpecifications`. If the file was just created, use `project.matchesGlobPattern` instead:

```ts
watcher.on('add', async (file) => {
  const specifications = []
  for (const project of vitest.projects) {
    if (project.matchesGlobPattern(file)) {
      specifications.push(project.createSpecification(file))
    }
  }

  if (specifications.length) {
    await vitest.rerunTestSpecifications(specifications)
  }
})
```
:::

In cases where you need to disable the watcher, you can pass down `server.watch: null` since Vite 5.3 or `server.watch: { ignored: ['*/*'] }` to a Vite config:

```ts
await createVitest(
  'test',
  {},
  {
    plugins: [
      {
        name: 'stop-watcher',
        async configureServer(server) {
          await server.watcher.close()
        }
      }
    ],
    server: {
      watch: null,
    },
  }
)
```
