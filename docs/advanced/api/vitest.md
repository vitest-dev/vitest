---
outline: deep
title: Vitest API
---

# Vitest

Vitest instance requires the current test mode. It can be either:

- `test` when running runtime tests
- `benchmark` when running benchmarks <Badge type="warning">experimental</Badge>

::: details New in Vitest 3
Vitest 3 is one step closer to stabilising the public API. To achieve that, we deprecated and removed some of the previously public methods on the `Vitest` class. These APIs were made private:

- `configOverride` (use [`setGlobalTestNamePattern`](#setglobaltestnamepattern) or [`enableSnapshotUpdate`](#enablesnapshotupdate))
- `coverageProvider`
- `filenamePattern`
- `runningPromise`
- `closingPromise`
- `isCancelling`
- `coreWorkspaceProject`
- `resolvedProjects`
- `_browserLastPort`
- `_options`
- `reporters`
- `vitenode`
- `runner`
- `pool`
- `setServer`
- `_initBrowserServers`
- `rerunTask`
- `changeProjectName`
- `changeNamePattern`
- `changeFilenamePattern`
- `rerunFailed`
- `_createRootProject` (renamed to `_ensureRootProject`, but still private)
- `filterTestsBySource` (this was moved to the new internal `vitest.specifications` instance)
- `runFiles` (use [`runTestSpecifications`](#runtestspecifications) instead)
- `onAfterSetServer`

These APIs were deprecated:
- `invalidates`
- `changedTests` (use [`onFilterWatchedSpecification`](#onfilterwatchedspecification) instead)
- `server` (use [`vite`](#vite) instead)
- `getProjectsByTestFile` (use [`getModuleSpecifications`](#getmodulespecifications) instead)
- `getFileWorkspaceSpecs` (use [`getModuleSpecifications`](#getmodulespecifications) instead)
- `getModuleProjects` (filter by [`this.projects`](#projects) yourself)
- `updateLastChanged` (renamed to [`invalidateFile`](#invalidatefile))
- `globTestSpecs` (use [`globTestSpecifications`](#globtestspecifications) instead)
- `globTestFiles` (use [`globTestSpecifications`](#globtestspecifications) instead)
- `listFile` (use [`getRelevantTestSpecifications`](#getrelevanttestspecifications) instead)
:::

## mode

### test

Test mode will only call functions inside `test` or `it`, and throws an error when `bench` is encountered. This mode uses `include` and `exclude` options in the config to find test files.

### benchmark <Badge type="warning">experimental</Badge>

Benchmark mode calls `bench` functions and throws an error, when it encounters `test` or `it`. This mode uses `benchmark.include` and `benchmark.exclude` options in the config to find benchmark files.

## config

The root (or global) config. If workspace feature is enabled, projects will reference this as `globalConfig`.

::: warning
This is Vitest config, it doesn't extend _Vite_ config. It only has resolved values from the `test` property.
:::

## vite

This is a global [`ViteDevServer`](https://vite.dev/guide/api-javascript#vitedevserver).

## state <Badge type="warning">experimental</Badge>

::: warning
Public `state` is an experimental API (except `vitest.state.getReportedEntity`). Breaking changes might not follow SemVer, please pin Vitest's version when using it.
:::

Global state stores information about the current tests. It uses the same API from `@vitest/runner` by default, but we recommend using the [Reported Tasks API](/advanced/reporters#reported-tasks) instead by calling `state.getReportedEntity()` on the `@vitest/runner` API:

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

## projects

An array of [test projects](/advanced/api/test-project) that belong to the user's workspace. If the user did not specify a custom workspace, the workspace will only have a [root project](#getrootproject).

Vitest will ensure that there is always at least one project in the workspace. If the user specifies a non-existent `--project` name, Vitest will throw an error.

## getRootProject

```ts
function getRootProject(): TestProject
```

This returns the root test project. The root project generally doesn't run any tests and is not included in `vitest.projects` unless the user explicitly includes the root config in their workspace, or the workspace is not defined at all.

The primary goal of the root project is to setup the global config. In fact, `rootProject.config` references `rootProject.globalConfig` and `vitest.config` directly:

```ts
rootProject.config === rootProject.globalConfig === rootProject.vitest.config
```

## provide

```ts
function provide<T extends keyof ProvidedContext & string>(
  key: T,
  value: ProvidedContext[T],
): void
```

Vitest exposes `provide` method which is a shorthand for `vitest.getRootProject().provide`. With this method you can pass down values from the main thread to tests. All values are checked with `structuredClone` before they are stored, but the values themselves are not cloned.

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
Technically, `provide` is a method of [`TestProject`](/advanced/api/test-project), so it is limited to the specific project. However, all projects inherit the values from the core project which makes `vitest.provide` universal way of passing down values to tests.
:::

## getProvidedContext

```ts
function getProvidedContext(): ProvidedContext
```

This returns the root context object. This is a shorthand for `vitest.getRootProject().getProvidedContext`.

## getProjectByName

```ts
function getProjectByName(name: string): TestProject
```

This method returns the project by its name. Simillar to calling `vitest.projects.find`.

::: warning
In case the project doesn't exist, this method will return the root project - make sure to check the names again if the project you are looking for is the one returned.

If user didn't customize a name, the Vitest will assign an empty string as a name.
:::

## globTestSpecifications

```ts
function globTestSpecifications(
  filters?: string[],
): Promise<TestSpecification[]>
```

This method constructs new [test specifications](/advanced/api/test-specification) by collecting every test in all projects with [`project.globTestFiles`](/advanced/api/test-project#globtestfiles). It accepts string filters to match the test files - these are the same filters that [CLI supports](/guide/filtering#cli).

This method automatically caches all test specifications. When you call [`getModuleSpecifications`](#getmodulespecifications) next time, it will return the same specifications unless [`clearSpecificationsCache`](#clearspecificationscache) was called before that.

::: warning
As of Vitest 3, it's possible to have multiple test specifications with the same module ID (file path) if `poolMatchGlob` has several pools or if `typecheck` is enabled. This possibility will be removed in Vitest 4.
:::

```ts
const specifications = await vitest.globTestSpecifications(['my-filter'])
// [TestSpecification{ moduleId: '/tests/my-filter.test.ts' }]
console.log(specifications)
```

## getRelevantTestSpecifications

```ts
function getRelevantTestSpecifications(
  filters?: string[]
): Promise<TestSpecification[]>
```

This method resolves every test specification by calling [`project.globTestFiles`](/advanced/api/test-project#globtestfiles). It accepts string filters to match the test files - these are the same filters that [CLI supports](/guide/filtering#cli). If `--changed` flag was specified, the list will be filtered to include only files that changed. `getRelevantTestSpecifications` doesn't run any test files.

::: warning
This method can be slow because it needs to filter `--changed` flags. Do not use it if you just need a list of test files.

- If you need to get the list of specifications for known test files, use [`getModuleSpecifications`](#getmodulespecifications) instead.
- If you need to get the list of all possible test files, use [`globTestSpecifications`](#globtestspecifications).
:::

## mergeReports

```ts
function mergeReports(directory?: string): Promise<TestRunResult>
```

Merge reports from multiple runs located in the specified directory (value from `--merge-reports` if not specified). This value can also be set on `config.mergeReports` (by default, it will read `.vitest-reports` folder).

Note that the `directory` will always be resolved relative to the working directory.

This method is called automatically by [`startVitest`](/advanced/guide/tests) if `config.mergeReports` is set.

## collect

```ts
function collect(filters?: string[]): Promise<TestRunResult>
```

Execute test files without running test callbacks. `collect` returns unhandled errors and an array of [test modules](/advanced/api/test-module). It accepts string filters to match the test files - these are the same filters that [CLI supports](/guide/filtering#cli).

This method resolves tests specifications based on the config `include`, `exclude`, and `includeSource` values. Read more at [`project.globTestFiles`](/advanced/api/test-project#globtestfiles). If `--changed` flag was specified, the list will be filtered to include only files that changed.

::: warning
Note that Vitest doesn't use static analysis to collect tests. Vitest will run every test file in isolation, just like it runs regular tests.

This makes this method very slow, unless you disable isolation before collecting tests.
:::

## start

```ts
function start(filters?: string[]): Promise<TestRunResult>
```

Initialize reporters, the coverage provider, and run tests. This method accepts string filters to match the test files - these are the same filters that [CLI supports](/guide/filtering#cli).

::: warning
This method should not be called if [`vitest.init()`](#init) is also invoked. Use [`runTestSpecifications`](#runtestspecifications) or [`rerunTestSpecifications`](#reruntestspecifications) instead if you need to run tests after Vitest was inititalised.
:::

This method is called automatically by [`startVitest`](/advanced/guide/tests) if `config.mergeReports` and `config.standalone` are not set.

## init

```ts
function init(): Promise<void>
```

Initialize reporters and the coverage provider. This method doesn't run any tests. If the `--watch` flag is provided, Vitest will still run changed tests even if this method was not called.

Internally, this method is called only if [`--standalone`](/guide/cli#standalone) flag is enabled.

::: warning
This method should not be called if [`vitest.start()`](#start) is also invoked.
:::

This method is called automatically by [`startVitest`](/advanced/guide/tests) if `config.standalone` is set.

## getModuleSpecifications

```ts
function getModuleSpecifications(moduleId: string): TestSpecification[]
```

Returns a list of test specifications related to the module ID. The ID should already be resolved to an absolute file path. If ID doesn't match `include` or `includeSource` patterns, the returned array will be empty.

This method can return already cached specifications based on the `moduleId` and `pool`. But note that [`project.createSpecification`](/advanced/api/test-project#createspecification) always returns a new instance and it's not cached automatically. However, specifications are automatically cached when [`runTestSpecifications`](#runtestspecifications) is called.

::: warning
As of Vitest 3, this method uses a cache to check if the file is a test. To make sure that the cache is not empty, call [`globTestSpecifications`](#globtestspecifications) at least once.
:::

## clearSpecificationsCache

```ts
function clearSpecificationsCache(moduleId?: string): void
```

Vitest automatically caches test specifications for each file when [`globTestSpecifications`](#globtestspecifications) or [`runTestSpecifications`](#runtestspecifications) is called. This method clears the cache for the given file or the whole cache alltogether depending on the first argument.

## runTestSpecifications

```ts
function runTestSpecifications(
  specifications: TestSpecification[],
  allTestsRun = false
): Promise<TestRunResult>
```

This method runs every test based on the received [specifications](/advanced/api/test-specification). The second argument, `allTestsRun`, is used by the coverage provider to determine if it needs to instrument coverage on _every_ file in the root (this only matters if coverage is enabled and `coverage.all` is set to `true`).

::: warning
This method doesn't trigger `onWatcherRerun`, `onWatcherStart` and `onTestsRerun` callbacks. If you are rerunning tests based on the file change, consider using [`rerunTestSpecifications`](#reruntestspecifications) instead.
:::

## rerunTestSpecifications

```ts
function rerunTestSpecifications(
  specifications: TestSpecification[],
  allTestsRun = false
): Promise<TestRunResult>
```

This method emits `reporter.onWatcherRerun` and `onTestsRerun` events, then it runs tests with [`runTestSpecifications`](#runtestspecifications). If there were no errors in the main process, it will emit `reporter.onWatcherStart` event.

## updateSnapshot

```ts
function updateSnapshot(files?: string[]): Promise<TestRunResult>
```

Update snapshots in specified files. If no files are provided, it will update files with failed tests and obsolete snapshots.

## collectTests

```ts
function collectTests(
  specifications: TestSpecification[]
): Promise<TestRunResult>
```

Execute test files without running test callbacks. `collectTests` returns unhandled errors and an array of [test modules](/advanced/api/test-module).

This method works exactly the same as [`collect`](#collect), but you need to provide test specifications yourself.

::: warning
Note that Vitest doesn't use static analysis to collect tests. Vitest will run every test file in isolation, just like it runs regular tests.

This makes this method very slow, unless you disable isolation before collecting tests.
:::

## cancelCurrentRun

```ts
function cancelCurrentRun(reason: CancelReason): Promise<void>
```

This method will gracefully cancel all ongoing tests. It will wait for started tests to finish running and will not run tests that were scheduled to run but haven't started yet.

## setGlobalTestNamePattern

```ts
function setGlobalTestNamePattern(pattern: string | RegExp): void
```

This methods overrides the global [test name pattern](/config/#testnamepattern).

::: warning
This method doesn't start running any tests. To run tests with updated pattern, call [`runTestSpecifications`](#runtestspecifications).
:::

## resetGlobalTestNamePattern

```ts
function resetGlobalTestNamePattern(): void
```

This methods resets the [test name pattern](/config/#testnamepattern). It means Vitest won't skip any tests now.

::: warning
This method doesn't start running any tests. To run tests without a pattern, call [`runTestSpecifications`](#runtestspecifications).
:::

## enableSnapshotUpdate

```ts
function enableSnapshotUpdate(): void
```

Enable the mode that allows updating snapshots when running tests. Every test that runs after this method is called will update snapshots. To disable the mode, call [`resetSnapshotUpdate`](#resetsnapshotupdate).

::: warning
This method doesn't start running any tests. To update snapshots, run tests with [`runTestSpecifications`](#runtestspecifications).
:::

## resetSnapshotUpdate

```ts
function resetSnapshotUpdate(): void
```

Disable the mode that allows updating snapshots when running tests. This method doesn't start running any tests.

## invalidateFile

```ts
function invalidateFile(filepath: string): void
```

This method invalidates the file in the cache of every project. It is mostly useful if you rely on your own watcher because Vite's cache persist in memory.

::: danger
If you disable Vitest's watcher but keep Vitest running, it is important to manually clear the cache with this method because there is no way to disable the cache. This method will also invalidate file's importers.
:::

## import

<!--@include: ./import-example.md-->

Import a file using Vite module runner. The file will be transformed by Vite with the global config and executed in a separate context. Note that `moduleId` will be relative to the `config.root`.

::: danger
`project.import` reuses Vite's module graph, so importing the same module using a regular import will return a different module:

```ts
import * as staticExample from './example.js'
const dynamicExample = await vitest.import('./example.js')

dynamicExample !== staticExample // ✅
```
:::

::: info
Internally, Vitest uses this method to import global setups, custom coverage providers, workspace file, and custom reporters, meaning all of them share the same module graph as long as they belong to the same Vite server.
:::

## close

```ts
function close(): Promise<void>
```

Closes all projects and their associated resources. This can only be called once; the closing promise is cached until the server restarts.

## exit

```ts
function exit(force = false): Promise<void>
```

Closes all projects and exit the process. If `force` is set to `true`, the process will exit immediately after closing the projects.

This method will also forcefuly call `process.exit()` if the process is still active after [`config.teardownTimeout`](/config/#teardowntimeout) milliseconds.

## shouldKeepServer

```ts
function shouldKeepServer(): boolean
```

This method will return `true` if the server should be kept running after the tests are done. This usually means that the `watch` mode was enabled.

## onServerRestart

```ts
function onServerRestart(fn: OnServerRestartHandler): void
```

Register a handler that will be called when the server is restarted due to a config change.

## onCancel

```ts
function onCancel(fn: (reason: CancelReason) => Awaitable<void>): void
```

Register a handler that will be called when the test run is cancelled with [`vitest.cancelCurrentRun`](#cancelcurrentrun).

## onClose

```ts
function onClose(fn: () => Awaitable<void>): void
```

Register a handler that will be called when the server is closed.

## onTestsRerun

```ts
function onTestsRerun(fn: OnTestsRerunHandler): void
```

Register a handler that will be called when the tests are rerunning. The tests can rerun when [`rerunTestSpecifications`](#reruntestspecifications) is called manually or when a file is changed and the built-in watcher schedules a rerun.

## onFilterWatchedSpecification

```ts
function onFilterWatchedSpecification(
  fn: (specification: TestSpecification) => boolean
): void
```
Register a handler that will be called when a file is changed. This callback should return `true` or `false`, indicating whether the test file needs to be rerun.

With this method, you can hook into the default watcher logic to delay or discard tests that the user doesn't want to keep track of at the moment:

```ts
const continuesTests: string[] = []

myCustomWrapper.onContinuesRunEnabled(testItem =>
  continuesTests.push(item.fsPath)
)

vitest.onFilterWatchedSpecification(specification =>
  continuesTests.includes(specification.moduleId)
)
```

Vitest can create different specifications for the same file depending on the `pool` or `locations` options, so do not rely on the reference. Vitest can also return cached specification from [`vitest.getModuleSpecifications`](#getmodulespecifications) - the cache is based on the `moduleId` and `pool`. Note that [`project.createSpecification`](/advanced/api/test-project#createspecification) always returns a new instance.
