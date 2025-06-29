---
title: Migration Guide | Guide
outline: deep
---

# Migration Guide

## Migrating to Vitest 4.0 {#vitest-4}

### Removed `reporters: 'basic'`

Basic reporter is removed as it is equal to:

```ts
export default defineConfig({
  test: {
    reporters: [
      ['default', { summary: false }]
    ]
  }
})
```

### V8 Code Coverage Major Changes

Vitest's V8 code coverage provider is now using more accurate coverage result remapping logic.
It is expected for users to see changes in their coverage reports when updating from Vitest v3.

In the past Vitest used [`v8-to-istanbul`](https://github.com/istanbuljs/v8-to-istanbul) for remapping V8 coverage results into your source files.
This method wasn't very accurate and provided plenty of false positives in the coverage reports.
We've now developed a new package that utilizes AST based analysis for the V8 coverage.
This allows V8 reports to be as accurate as `@vitest/coverage-istanbul` reports.

- Coverage ignore hints have updated. See [Coverage | Ignoring Code](/guide/coverage.html#ignoring-code).
- `coverage.ignoreEmptyLines` is removed. Lines without runtime code are no longer included in reports.
- `coverage.experimentalAstAwareRemapping` is removed. This option is now enabled by default, and is the only supported remapping method.
- `coverage.ignoreClassMethods` is now supported by V8 provider too.

### Removed options `coverage.all` and `coverage.extensions`

In previous versions Vitest included all uncovered files in coverage report by default.
This was due to `coverage.all` defaulting to `true`, and `coverage.include` defaulting to `**`.
These default values were chosen for a good reason - it is impossible for testing tools to guess where users are storing their source files.

This ended up having Vitest's coverage providers processing unexpected files, like minified Javascript, leading to slow/stuck coverage report generations.
In Vitest v4 we have removed `coverage.all` completely and <ins>**defaulted to include only covered files in the report**</ins>.

When upgrading to v4 it is recommended to define `coverage.include` in your configuration, and then start applying simple `coverage.exclusion` patterns if needed.

```ts [vitest.config.ts]
export default defineConfig({
  test: {
    coverage: {
      // Include covered and uncovered files matching this pattern:
      include: ['packages/**/src/**.{js,jsx,ts,tsx}'], // [!code ++]

      // Exclusion is applied for the files that match include pattern above
      // No need to define root level *.config.ts files or node_modules, as we didn't add those in include
      exclude: ['**/some-pattern/**'], // [!code ++]

      // These options are removed now
      all: true, // [!code --]
      extensions: ['js', 'ts'], // [!code --]
    }
  }
})
```

If `coverage.include` is not defined, coverage report will include only files that were loaded during test run:
```ts [vitest.config.ts]
export default defineConfig({
  test: {
    coverage: {
      // Include not set, include only files that are loaded during test run
      include: undefined, // [!code ++]

      // Loaded files that match this pattern will be excluded:
      exclude: ['**/some-pattern/**'], // [!code ++]
    }
  }
})
```

See also new guides:
- [Including and excluding files from coverage report](/guide/coverage.html#including-and-excluding-files-from-coverage-report) for examples
- [Profiling Test Performance | Code coverage](/guide/profiling-test-performance.html#code-coverage) for tips about debugging coverage generation

### `spyOn` Supports Constructors

Previously, if you tried to spy on a constructor with `vi.spyOn`, you would get an error like `Constructor <name> requires 'new'`. Since Vitest 4, all mocks called with a `new` keyword construct the instance instead of callying `mock.apply`. This means that the mock implementation has to use either the `function` or the `class` keyword in these cases:

```ts {12-14,16-20}
const cart = {
  Apples: class Apples {
    getApples() {
      return 42
    }
  }
}

const Spy = vi.spyOn(cart, 'Apples')
  .mockImplementation(() => ({ getApples: () => 0 })) // [!code --]
  // with a function keyword
  .mockImplementation(function () {
    this.getApples = () => 0
  })
  // with a custom class
  .mockImplementation(class MockApples {
    getApples() {
      return 0
    }
  })

const mock = new Spy()
```

Note that now if you provide an arrow function, you will get [`<anonymous> is not a constructor` error](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Errors/Not_a_constructor) when the mock is called.

### Deprecated APIs are Removed

Vitest 4.0 removes some deprecated APIs, including:

- `poolMatchGlobs` config option. Use [`projects`](/guide/projects) instead.
- `environmentMatchGlobs` config option. Use [`projects`](/guide/projects) instead.
- `workspace` config option. Use [`projects`](/guide/projects) instead.

This release also removes all deprecated types. This finally fixes an issue where Vitest accidentally pulled in `node` types (see [#5481](https://github.com/vitest-dev/vitest/issues/5481) and [#6141](https://github.com/vitest-dev/vitest/issues/6141)).

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

<!--@include: ./examples/promise-done.md-->

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
