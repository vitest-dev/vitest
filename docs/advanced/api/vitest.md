---
outline: deep
---

# Vitest

Vitest instance requires the current test mode. It can be either:

- `test` when running runtime tests
- `benchmark` when running benchmarks

## mode

### test

Test mode will only call functions inside `test` or `it`, and throws an error when `bench` is encountered. This mode uses `include` and `exclude` options in the config to find test files.

### benchmark

Benchmark mode calls `bench` functions and throws an error, when it encounters `test` or `it`. This mode uses `benchmark.include` and `benchmark.exclude` options in the config to find benchmark files.

## start

```ts
function start(filters: string[]): Promise<TestRunResult>
```

You can start running tests or benchmarks with `start` method. You can pass an array of strings to filter test files.

## config

The root (or global) config. If workspace feature is enabled, projects will reference this as `globalConfig`.

::: warning
This is Vitest config, it doesn't extend _Vite_ config. It only has resolved values from the `test` property.
:::

## vite

This is a global [`ViteDevServer`](https://vite.dev/guide/api-javascript#vitedevserver).

## state

::: warning
Public `state` is an experimental API. Breaking changes might not follow SemVer, please pin Vitest's version when using it.
:::

Global state stores information about the current tests. It uses the same API from `@vitest/runner` by default, but we recommend using the [Reported API](/advanced/reporters#reported-tasks) instead by calling `state.getReportedEntity()` on the `@vitest/runner` API:

```ts
const task = vitest.state.idMap.get(taskId) // old API
const testCase = vitest.state.getReportedEntity(task) // new API
```

In the future, the old API won't be exposed anymore.

## snapshot

The global snapshot manager. Vitest keeps track of all snapshots using the `snapshot.add` method.

You can get the latest summary of snapshots via the `vitest.snapshot.summay` property.

## cache

Cache manager that stores information about latest test results and test file stats. In Vitest itself this is only used by the default sequencer to sort tests.

## ready

Vitest needs to be resolved with the Vite server to be properly initialized. If the `Vitest` instance was created manually, you might need to check the `ready` status before accessing the `vite`, `state`, `cache`, `config`, and `snapshot` properties; otherwise, they will throw an error in the getter.

In normal circumstances, you would never call this method because `createVitest` and `startVitest` return already resolved Vitest instance.

## getRootTestProject

This returns the root test project. The root project generally doesn't run any tests and is not included in `vitest.projects` unless the user explicitly includes the root config in their workspace.

The primary goal of the root project is to setup the global config. In fact, `rootProject.config` references `rootProject.globalConfig` and `vitest.config` directly.

## provide

Vitest exposes `provide` method which is a shorthand for `vitest.getRootTestProject().provide`. With this method you can pass down values from the main thread to tests. All values are checked with `structuredClone` before they are stored, but the values themselves are not cloned.

To recieve the values in the test, you need to import `inject` method from `vitest` entrypont:

```ts
import { inject } from 'vitest'
const port = inject('wsPort') // 3000
```

For better type safety, we encourage you to augment the type of `ProvidedContext`:

```ts
import { createVitest } from 'vitest/node'

const vitest = await createVitest('test', {
  watch: false,
})
vitest.provide('wsPort', 3000)

declare module 'vitest' {
  export interface ProvidedContext {
    wsPort: number
  }
}
```

::: warning
Technically, `provide` is a method of [`TestProject`](#testproject), so it is limited to the specific project. However, all projects inherit the values from the core project which makes `vitest.provide` universal way of passing down values to tests.
:::

## getProvidedContext

This returns the root context object. This is a shorthand for `vitest.getRootTestProject().getProvidedContext`.

## getProjectByName

This method returns the project by its name. Simillar to calling `vitest.projects.find`.

::: warning
In case the project doesn't exist, this method will return the root project - make sure to check the names again if you need to make sure the project you are looking for is the one returned.
:::

## globTestSpecifications

This method constructs new [test specifications](#testspecification) by collecting every test in all projects with [`project.globTestFiles`](#globtestfiles). It accepts string filters to match the test files.

::: warning
As of Vitest 2.2.0, it's possible to have multiple test specifications with the same module ID (file path) if `poolMatchGlob` has several pools or if `typecheck` is enabled. This possibility will be removed in Vitest 3.
:::

```ts
const specifications = await vitest.globTestSpecifications(['my-filter'])
// [TestSpecification{ moduleId: '/tests/my-filter.test.ts' }]
console.log(specifications)
```

## mergeReports
## collect
## listFiles
## start
## init

## getModuleSpecifications

Returns a list of test specifications related to the module ID. The ID should already be resolved to an absolute file path. If ID doesn't match `include` or `includeSource` patterns, the returned array will be empty.

::: warning
As of Vitest 2.2.0, this method uses a cache to check if the file is a test. To make sure that the cache is not empty, call `globTestSpecifications` at least once.
:::

## runTestSpecifications
## rerunTestSpecifications
## collectTests
## cancelCurrentRun
## updateSnapshot
## invalidateFile
## close
## exit

## shouldKeepServer
## onServerRestart
## onCancel
## onClose
## onTestsRerun
## onFilterWatchedSpecification
