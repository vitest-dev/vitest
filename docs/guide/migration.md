---
title: Migration Guide | Guide
outline: deep
---

# Migration Guide

## Migrating to Vitest 3.0 {#vitest-3}

### Test Options as a Third Argument

Vitest 3.0 prints a warning if you pass down an object as a third argument to `test` or `describe` functions:

```ts
test('validation works', () => {
  // ...
}, { retry: 3 }) // [!code --]

test('validation works', { retry: 3 }, () => { // [!code ++]
  // ...
})
```

Vitest 4.0 will throw an error if the third argument is an object. Note that the timeout number is not deprecated:

```ts
test('validation works', () => {
  // ...
}, 1000) // Ok ✅
```

### `browser.name` and `browser.providerOptions` are Deprecated

Both [`browser.name`](/guide/browser/config#browser-name) and [`browser.providerOptions`](/guide/browser/config#browser-provideroptions) will be removed in Vitest 4. Instead of them, use the new [`browser.instances`](/guide/browser/config#browser-instances) option:

```ts
export default defineConfig({
  test: {
    browser: {
      name: 'chromium', // [!code --]
      providerOptions: { // [!code --]
        launch: { devtools: true }, // [!code --]
      }, // [!code --]
      instances: [ // [!code ++]
        { // [!code ++]
          browser: 'chromium', // [!code ++]
          launch: { devtools: true }, // [!code ++]
        }, // [!code ++]
      ], // [!code ++]
    },
  },
})
```

With the new `browser.instances` field you can also specify multiple browser configurations.

### `spy.mockReset` Now Restores the Original Implementation

There was no good way to reset the spy to the original implementation without reaplying the spy. Now, `spy.mockReset` will reset the implementation function to the original one instead of a fake noop.

```ts
const foo = {
  bar: () => 'Hello, world!'
}

vi.spyOn(foo, 'bar').mockImplementation(() => 'Hello, mock!')

foo.bar() // 'Hello, mock!'

foo.bar.mockReset()

foo.bar() // undefined // [!code --]
foo.bar() // 'Hello, world!' // [!code ++]
```

### `vi.spyOn` Reuses Mock if Method is Already Mocked

Previously, Vitest would always assign a new spy when spying on an object. This caused errors with `mockRestore` because it would restore the spy to the previous spy instead of the original function:

```ts
vi.spyOn(fooService, 'foo').mockImplementation(() => 'bar')
vi.spyOn(fooService, 'foo').mockImplementation(() => 'bar')
vi.restoreAllMocks()
vi.isMockFunction(fooService.foo) // true // [!code --]
vi.isMockFunction(fooService.foo) // false // [!code ++]
```

### Fake Timers Defaults

Vitest no longer provides default `fakeTimers.toFake` options. Now, Vitest will mock any timer-related API if it is available (except `nextTick`). Namely, `performance.now()` is now mocked when `vi.useFakeTimers` is called.

```ts
vi.useFakeTimers()

performance.now() // original // [!code --]
performance.now() // fake // [!code ++]
```

You can revert to the previous behaviour by specifying timers when calling `vi.useFakeTimers` or globally in the config:

```ts
export default defineConfig({
  test: {
    fakeTimers: {
      toFake: ['setTimeout', 'clearTimeout', 'Date'], // [!code ++]
    },
  },
})
```

### More Strict Error Equality

Vitest now checks more properties when comparing errors via `toEqual` or `toThrowError`. Vitest now compares `name`, `message`, `cause` and `AggregateError.errors`. For `Error.cause`, the comparison is done asymmetrically:

```ts
expect(new Error('hi', { cause: 'x' })).toEqual(new Error('hi')) // ✅
expect(new Error('hi')).toEqual(new Error('hi', { cause: 'x' })) // ❌
```

In addition to more properties check, Vitest now compares error prototypes. For example, if `TypeError` was thrown, the equality check should reference `TypeError`, not `Error`:

```ts
expect(() => {
  throw new TypeError('type error')
})
  .toThrowError(new Error('type error')) // [!code --]
  .toThrowError(new TypeError('type error')) // [!code ++]
```

See PR for more details: [#5876](https://github.com/vitest-dev/vitest/pull/5876).

### `module` condition export is not resolved by default on Vite 6

Vite 6 allows more flexible [`resolve.conditions`](https://vite.dev/config/shared-options#resolve-conditions) options and Vitest configures it to exclude `module` conditional export by default.

### `Custom` Type is Deprecated <Badge type="danger">API</Badge> {#custom-type-is-deprecated}

The `Custom` type is now an alias for the `Test` type. Note that Vitest updated the public types in 2.1 and changed exported names to `RunnerCustomCase` and `RunnerTestCase`:

```ts
import {
  RunnerCustomCase, // [!code --]
  RunnerTestCase, // [!code ++]
} from 'vitest'
```

If you are using `getCurrentSuite().custom()`, the `type` of the returned task is now is equal to `'test'`. The `Custom` type will be removed in Vitest 4.

### The `WorkspaceSpec` Type is No Longer Used <Badge type="danger">API</Badge> {#the-workspacespec-type-is-no-longer-used}

In the public API this type was used in custom [sequencers](/config/#sequence-sequencer) before. Please, migrate to [`TestSpecification`](/advanced/api/test-specification) instead.

### `onTestFinished` and `onTestFailed` Now Receive a Context

The [`onTestFinished`](/api/#ontestfinished) and [`onTestFailed`](/api/#ontestfailed) hooks previously received a test result as the first argument. Now, they receive a test context, like `beforeEach` and `afterEach`.

### Changes to the Snapshot API <Badge type="danger">API</Badge> {#changes-to-the-snapshot-api}

The public Snapshot API in `@vitest/snapshot` was changed to support multiple states within a single run. See PR for more details: [#6817](https://github.com/vitest-dev/vitest/pull/6817)

Note that this changes only affect developers using the Snapshot API directly. There were no changes to `.toMatchSnapshot` API.

### Changes to `resolveConfig` Type Signature <Badge type="danger">API</Badge> {#changes-to-resolveconfig-type-signature}

The [`resolveConfig`](/advanced/api/#resolveconfig) is now more useful. Instead of accepting already resolved Vite config, it now accepts a user config and returns resolved config.

This function is not used internally and exposed exclusively as a public API.

### Cleaned up `vitest/reporters` types <Badge type="danger">API</Badge> {#cleaned-up-vitest-reporters-types}

The `vitest/reporters` entrypoint now only exports reporters implementations and options types. If you need access to `TestCase`/`TestSuite` and other task related types, import them additionally from `vitest/node`.

### Coverage ignores test files even when `coverage.excludes` is overwritten.

It is no longer possible to include test files in coverage report by overwriting `coverage.excludes`. Test files are now always excluded.

## Migrating to Vitest 2.0 {#vitest-2}

### Default Pool is `forks`

Vitest 2.0 changes the default configuration for `pool` to `'forks'` for better stability. You can read the full motivation in [PR](https://github.com/vitest-dev/vitest/pull/5047).

If you've used `poolOptions` without specifying a `pool`, you might need to update the configuration:

```ts
export default defineConfig({
  test: {
    poolOptions: {
      threads: { // [!code --]
        singleThread: true, // [!code --]
      }, // [!code --]
      forks: { // [!code ++]
        singleFork: true, // [!code ++]
      }, // [!code ++]
    }
  }
})
```

### Hooks are Running in a Stack

Before Vitest 2.0, all hooks ran in parallel. In 2.0, all hooks run serially. Additionally, `afterAll`/`afterEach` hooks run in reverse order.

To revert to the parallel execution of hooks, change [`sequence.hooks`](/config/#sequence-hooks) to `'parallel'`:

```ts
export default defineConfig({
  test: {
    sequence: { // [!code ++]
      hooks: 'parallel', // [!code ++]
    }, // [!code ++]
  },
})
```

### `suite.concurrent` Runs All Tests Concurrently

Previously, specifying `concurrent` on a suite would group concurrent tests by suites, running them sequentially. Now, following Jest's behavior, all tests run concurrently (subject to [`maxConcurrency`](/config/#maxconcurrency) limits).

### V8 Coverage's `coverage.ignoreEmptyLines` is Enabled by Default

The default value of `coverage.ignoreEmptyLines` is now true. This significant change may affect code coverage reports, requiring adjustments to coverage thresholds for some projects. This adjustment only affects the default setting when `coverage.provider` is `'v8'`.

### Removal of the `watchExclude` Option

Vitest uses Vite's watcher. Exclude files or directories by adding them to `server.watch.ignored`:

```ts
export default defineConfig({
  server: { // [!code ++]
    watch: { // [!code ++]
      ignored: ['!node_modules/examplejs'] // [!code ++]
    } // [!code ++]
  } // [!code ++]
})
```

### `--segfault-retry` Removed

With the changes to default pool, this option is no longer needed. If you experience segfault errors, try switching to `'forks'` pool. If the problem persists, please open a new issue with a reproduction.

### Empty Task In Suite Tasks Removed

This is the change to the advanced [task API](/advanced/runner#your-task-function). Previously, traversing `.suite` would eventually lead to the empty internal suite that was used instead of a file task.

This makes `.suite` optional; if the task is defined at the top level, it will not have a suite. You can fallback to the `.file` property that is now present on all tasks (including the file task itself, so be careful not to fall into the endless recursion).

This change also removes the file from `expect.getState().currentTestName` and makes `expect.getState().testPath` required.

### `task.meta` is Added to the JSON Reporter

JSON reporter now prints `task.meta` for every assertion result.

### Simplified Generic Types of Mock Functions (e.g. `vi.fn<T>`, `Mock<T>`)

Previously `vi.fn<TArgs, TReturn>` accepted two generic types separately for arguments and return value. This is changed to directly accept a function type `vi.fn<T>` to simplify the usage.

```ts
import { type Mock, vi } from 'vitest'

const add = (x: number, y: number): number => x + y

// using vi.fn<T>
const mockAdd = vi.fn<Parameters<typeof add>, ReturnType<typeof add>>() // [!code --]
const mockAdd = vi.fn<typeof add>() // [!code ++]

// using Mock<T>
const mockAdd: Mock<Parameters<typeof add>, ReturnType<typeof add>> = vi.fn() // [!code --]
const mockAdd: Mock<typeof add> = vi.fn() // [!code ++]
```

### Accessing Resolved `mock.results`

Previously Vitest resolved `mock.results` values if the function returned a Promise. Now there is a separate [`mock.settledResults`](/api/mock#mock-settledresults) property that populates only when the returned Promise is resolved or rejected.

```ts
const fn = vi.fn().mockResolvedValueOnce('result')
await fn()

const result = fn.mock.results[0] // 'result' // [!code --]
const result = fn.mock.results[0] // 'Promise<result>' // [!code ++]

const settledResult = fn.mock.settledResults[0] // 'result'
```

With this change, we also introduce new [`toHaveResolved*`](/api/expect#tohaveresolved) matchers similar to `toHaveReturned` to make migration easier if you used `toHaveReturned` before:

```ts
const fn = vi.fn().mockResolvedValueOnce('result')
await fn()

expect(fn).toHaveReturned('result') // [!code --]
expect(fn).toHaveResolved('result') // [!code ++]
```

### Browser Mode

Vitest Browser Mode had a lot of changes during the beta cycle. You can read about our philosophy on the Browser Mode in the [GitHub discussion page](https://github.com/vitest-dev/vitest/discussions/5828).

Most of the changes were additive, but there were some small breaking changes:

- `none` provider was renamed to `preview` [#5842](https://github.com/vitest-dev/vitest/pull/5826)
- `preview` provider is now a default [#5842](https://github.com/vitest-dev/vitest/pull/5826)
- `indexScripts` is renamed to `orchestratorScripts` [#5842](https://github.com/vitest-dev/vitest/pull/5842)

### Deprecated Options Removed

Some deprecated options were removed:

- `vitest typecheck` command - use `vitest --typecheck` instead
- `VITEST_JUNIT_CLASSNAME` and `VITEST_JUNIT_SUITE_NAME` env variables (use reporter options instead)
- check for `c8` coverage (use coverage-v8 instead)
- export of `SnapshotEnvironment` from `vitest` - import it from `vitest/snapshot` instead
- `SpyInstance` is removed in favor of `MockInstance`

## Migrating to Vitest 1.0

### Minimum Requirements

Vitest 1.0 requires Vite 5.0 and Node.js 18 or higher.

All `@vitest/*` sub packages require Vitest version 1.0.

### Snapshots Update [#3961](https://github.com/vitest-dev/vitest/pull/3961)

Quotes in snapshots are no longer escaped, and all snapshots use backtick quotes (`) even if the string is just a single line.

1. Quotes are no longer escaped:

```diff
expect({ foo: 'bar' }).toMatchInlineSnapshot(`
  Object {
-    \\"foo\\": \\"bar\\",
+    "foo": "bar",
  }
`)
```

2. One-line snapshots now use "`" quotes instead of ':

```diff
- expect('some string').toMatchInlineSnapshot('"some string"')
+ expect('some string').toMatchInlineSnapshot(`"some string"`)
```

There were also [changes](https://github.com/vitest-dev/vitest/pull/4076) to `@vitest/snapshot` package. If you are not using it directly, you don't need to change anything.

- You no longer need to extend `SnapshotClient` just to override `equalityCheck` method: just pass it down as `isEqual` when initiating an instance
- `client.setTest` was renamed to `client.startCurrentRun`
- `client.resetCurrent` was renamed to `client.finishCurrentRun`

### Pools are Standardized [#4172](https://github.com/vitest-dev/vitest/pull/4172)

We removed a lot of configuration options to make it easier to configure the runner to your needs. Please, have a look at migration examples if you rely on `--threads` or other related flags.

- `--threads` is now `--pool=threads`
- `--no-threads` is now `--pool=forks`
- `--single-thread` is now `--poolOptions.threads.singleThread`
- `--experimental-vm-threads` is now `--pool=vmThreads`
- `--experimental-vm-worker-memory-limit` is now `--poolOptions.vmThreads.memoryLimit`
- `--isolate` is now `--poolOptions.<pool-name>.isolate` and `browser.isolate`
- `test.maxThreads` is now `test.poolOptions.<pool-name>.maxThreads`
- `test.minThreads` is now `test.poolOptions.<pool-name>.minThreads`
- `test.useAtomics` is now `test.poolOptions.<pool-name>.useAtomics`
- `test.poolMatchGlobs.child_process` is now `test.poolMatchGlobs.forks`
- `test.poolMatchGlobs.experimentalVmThreads` is now `test.poolMatchGlobs.vmThreads`

```diff
{
  scripts: {
-    "test": "vitest --no-threads"
     // For identical behaviour:
+    "test": "vitest --pool forks --poolOptions.forks.singleFork"
     // Or multi parallel forks:
+    "test": "vitest --pool forks"

  }
}
```

```diff
{
  scripts: {
-    "test": "vitest --experimental-vm-threads"
+    "test": "vitest --pool vmThreads"
  }
}
```

```diff
{
  scripts: {
-    "test": "vitest --isolate false"
+    "test": "vitest --poolOptions.threads.isolate false"
  }
}
```

```diff
{
  scripts: {
-    "test": "vitest --no-threads --isolate false"
+    "test": "vitest --pool forks --poolOptions.forks.isolate false"
  }
}
```

### Changes to Coverage [#4265](https://github.com/vitest-dev/vitest/pull/4265), [#4442](https://github.com/vitest-dev/vitest/pull/4442)

Option `coverage.all` is now enabled by default. This means that all project files matching `coverage.include` pattern will be processed even if they are not executed.

Coverage thresholds API's shape was changed, and it now supports specifying thresholds for specific files using glob patterns:

```diff
export default defineConfig({
  test: {
    coverage: {
-      perFile: true,
-      thresholdAutoUpdate: true,
-      100: true,
-      lines: 100,
-      functions: 100,
-      branches: 100,
-      statements: 100,
+      thresholds: {
+        perFile: true,
+        autoUpdate: true,
+        100: true,
+        lines: 100,
+        functions: 100,
+        branches: 100,
+        statements: 100,
+      }
    }
  }
})
```

### Mock Types [#4400](https://github.com/vitest-dev/vitest/pull/4400)

A few types were removed in favor of Jest-style "Mock" naming.

```diff
- import { EnhancedSpy, SpyInstance } from 'vitest'
+ import { MockInstance } from 'vitest'
```

::: warning
`SpyInstance` is deprecated in favor of `MockInstance` and will be removed in the next major release.
:::

### Timer mocks [#3925](https://github.com/vitest-dev/vitest/pull/3925)

`vi.useFakeTimers()` no longer automatically mocks [`process.nextTick`](https://nodejs.org/api/process.html#processnexttickcallback-args).
It is still possible to mock `process.nextTick` by explicitly specifying it by using `vi.useFakeTimers({ toFake: ['nextTick'] })`.

However, mocking `process.nextTick` is not possible when using `--pool=forks`. Use a different `--pool` option if you need `process.nextTick` mocking.

## Migrating from Jest {#jest}

Vitest has been designed with a Jest compatible API, in order to make the migration from Jest as simple as possible. Despite those efforts, you may still run into the following differences:

### Globals as a Default

Jest has their [globals API](https://jestjs.io/docs/api) enabled by default. Vitest does not. You can either enable globals via [the `globals` configuration setting](/config/#globals) or update your code to use imports from the `vitest` module instead.

If you decide to keep globals disabled, be aware that common libraries like [`testing-library`](https://testing-library.com/) will not run auto DOM [cleanup](https://testing-library.com/docs/svelte-testing-library/api/#cleanup).

### `spy.mockReset`

Jest's [`mockReset`](https://jestjs.io/docs/mock-function-api#mockfnmockreset) replaces the mock implementation with an
empty function that returns `undefined`.

Vitest's [`mockReset`](/api/mock#mockreset) resets the mock implementation to its original.
That is, resetting a mock created by `vi.fn(impl)` will reset the mock implementation to `impl`.

### Module Mocks

When mocking a module in Jest, the factory argument's return value is the default export. In Vitest, the factory argument has to return an object with each export explicitly defined. For example, the following `jest.mock` would have to be updated as follows:

```ts
jest.mock('./some-path', () => 'hello') // [!code --]
vi.mock('./some-path', () => ({ // [!code ++]
  default: 'hello', // [!code ++]
})) // [!code ++]
```

For more details please refer to the [`vi.mock` api section](/api/vi#vi-mock).

### Auto-Mocking Behaviour

Unlike Jest, mocked modules in `<root>/__mocks__` are not loaded unless `vi.mock()` is called. If you need them to be mocked in every test, like in Jest, you can mock them inside [`setupFiles`](/config/#setupfiles).

### Importing the Original of a Mocked Package

If you are only partially mocking a package, you might have previously used Jest's function `requireActual`. In Vitest, you should replace these calls with `vi.importActual`.

```ts
const { cloneDeep } = jest.requireActual('lodash/cloneDeep') // [!code --]
const { cloneDeep } = await vi.importActual('lodash/cloneDeep') // [!code ++]
```

### Extends mocking to external libraries

Where Jest does it by default, when mocking a module and wanting this mocking to be extended to other external libraries that use the same module, you should explicitly tell which 3rd-party library you want to be mocked, so the external library would be part of your source code, by using [server.deps.inline](https://vitest.dev/config/#server-deps-inline).

```
server.deps.inline: ["lib-name"]
```

### expect.getState().currentTestName

Vitest's `test` names are joined with a `>` symbol to make it easier to distinguish tests from suites, while Jest uses an empty space (` `).

```diff
- `${describeTitle} ${testTitle}`
+ `${describeTitle} > ${testTitle}`
```

### Envs

Just like Jest, Vitest sets `NODE_ENV` to `test`, if it wasn't set before. Vitest also has a counterpart for `JEST_WORKER_ID` called `VITEST_POOL_ID` (always less than or equal to `maxThreads`), so if you rely on it, don't forget to rename it. Vitest also exposes `VITEST_WORKER_ID` which is a unique ID of a running worker - this number is not affected by `maxThreads`, and will increase with each created worker.

### Replace property

If you want to modify the object, you will use [replaceProperty API](https://jestjs.io/docs/jest-object#jestreplacepropertyobject-propertykey-value) in Jest, you can use [`vi.stubEnv`](/api/#vi-stubenv) or [`vi.spyOn`](/api/vi#vi-spyon) to do the same also in Vitest.

### Done Callback

From Vitest v0.10.0, the callback style of declaring tests is deprecated. You can rewrite them to use `async`/`await` functions, or use Promise to mimic the callback style.

```
it('should work', (done) => {  // [!code --]
it('should work', () => new Promise(done => { // [!code ++]
  // ...
  done()
}) // [!code --]
})) // [!code ++]
```

### Hooks

`beforeAll`/`beforeEach` hooks may return [teardown function](/api/#setup-and-teardown) in Vitest. Because of that you may need to rewrite your hooks declarations, if they return something other than `undefined` or `null`:

```ts
beforeEach(() => setActivePinia(createTestingPinia())) // [!code --]
beforeEach(() => { setActivePinia(createTestingPinia()) }) // [!code ++]
```

In Jest hooks are called sequentially (one after another). By default, Vitest runs hooks in parallel. To use Jest's behavior, update [`sequence.hooks`](/config/#sequence-hooks) option:

```ts
export default defineConfig({
  test: {
    sequence: { // [!code ++]
      hooks: 'list', // [!code ++]
    } // [!code ++]
  }
})
```

### Types

Vitest doesn't have an equivalent to `jest` namespace, so you will need to import types directly from `vitest`:

```ts
let fn: jest.Mock<(name: string) => number> // [!code --]
import type { Mock } from 'vitest' // [!code ++]
let fn: Mock<(name: string) => number> // [!code ++]
```

### Timers

Vitest doesn't support Jest's legacy timers.

### Timeout

If you used `jest.setTimeout`, you would need to migrate to `vi.setConfig`:

```ts
jest.setTimeout(5_000) // [!code --]
vi.setConfig({ testTimeout: 5_000 }) // [!code ++]
```

### Vue Snapshots

This is not a Jest-specific feature, but if you previously were using Jest with vue-cli preset, you will need to install [`jest-serializer-vue`](https://github.com/eddyerburgh/jest-serializer-vue) package, and use it inside [setupFiles](/config/#setupfiles):

:::code-group
```js [vite.config.js]
import { defineConfig } from 'vite'

export default defineConfig({
  test: {
    setupFiles: ['./tests/unit/setup.js']
  }
})
```
```js [tests/unit/setup.js]
import vueSnapshotSerializer from 'jest-serializer-vue'

expect.addSnapshotSerializer(vueSnapshotSerializer)
```
:::

Otherwise your snapshots will have a lot of escaped `"` characters.
