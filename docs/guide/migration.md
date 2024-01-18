---
title: Migration Guide | Guide
outline: deep
---

# Migration Guide

## Migrating from Vitest 0.34.6

<!-- introduction -->

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
It's still possible to mock `process.nextTick` by explicitly specifying it by using `vi.useFakeTimers({ toFake: ['nextTick'] })`.

However, mocking `process.nextTick` is not possible when using `--pool=forks`. Use a different `--pool` option if you need `process.nextTick` mocking.

## Migrating from Jest

Vitest has been designed with a Jest compatible API, in order to make the migration from Jest as simple as possible. Despite those efforts, you may still run into the following differences:

### Globals as a Default

Jest has their [globals API](https://jestjs.io/docs/api) enabled by default. Vitest does not. You can either enable globals via [the `globals` configuration setting](/config/#globals) or update your code to use imports from the `vitest` module instead.

If you decide to keep globals disabled, be aware that common libraries like [`testing-library`](https://testing-library.com/) will not run auto DOM [cleanup](https://testing-library.com/docs/svelte-testing-library/api/#cleanup).

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

### Envs

Just like Jest, Vitest sets `NODE_ENV` to `test`, if it wasn't set before. Vitest also has a counterpart for `JEST_WORKER_ID` called `VITEST_POOL_ID` (always less than or equal to `maxThreads`), so if you rely on it, don't forget to rename it. Vitest also exposes `VITEST_WORKER_ID` which is a unique ID of a running worker - this number is not affected by `maxThreads`, and will increase with each created worker.

### Replace property

If you want to modify the object, you will use [replaceProperty API](https://jestjs.io/docs/jest-object#jestreplacepropertyobject-propertykey-value) in Jest, you can use [`vi.stubEnv`](https://vitest.dev/api/vi.html#vi-stubenv) or [`vi.spyOn`](/api/vi#vi-spyon) to do the same also in Vitest.

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
let fn: jest.Mock<string, [string]> // [!code --]
import type { Mock } from 'vitest' // [!code ++]
let fn: Mock<[string], string> // [!code ++]
```

Also, Vitest has `Args` type as a first argument instead of `Returns`, as you can see in diff.

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

`vite.config.js`

```js
import { defineConfig } from 'vite'

export default defineConfig({
  test: {
    setupFiles: ['./tests/unit/setup.js']
  }
})
```

`tests/unit/setup.js`

```js
import vueSnapshotSerializer from 'jest-serializer-vue'

expect.addSnapshotSerializer(vueSnapshotSerializer)
```

Otherwise your snapshots will have a lot of escaped `"` characters.
