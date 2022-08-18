---
outline: deep
---

# Configuring Vitest

## Configuration

`vitest` will read your root `vite.config.ts` when it is present to match with the plugins and setup as your Vite app. If you want to have a different configuration for testing or your main app doesn't rely on Vite specifically, you could either:

- Create `vitest.config.ts`, which will have the higher priority and will override the configuration from `vite.config.ts`
- Pass `--config` option to CLI, e.g. `vitest --config ./path/to/vitest.config.ts`
- Use `process.env.VITEST` or `mode` property on `defineConfig` (will be set to `test` if not overridden) to conditionally apply different configuration in `vite.config.ts`

To configure `vitest` itself, add `test` property in your Vite config. You'll also need to add a reference to Vitest types using a [triple slash command](https://www.typescriptlang.org/docs/handbook/triple-slash-directives.html#-reference-types-) at the top of your config file, if you are importing `defineConfig` from `vite` itself.

using `defineConfig` from `vite` you should follow this:

```ts
/// <reference types="vitest" />
import { defineConfig } from 'vite'

export default defineConfig({
  test: {
    // ...
  },
})
```

using `defineConfig` from `vitest/config` you should follow this:

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // ...
  },
})
```

You can retrieve Vitest's default options to expand them if needed:

```ts
import { configDefaults, defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    exclude: [...configDefaults.exclude, 'packages/template/*'],
  },
})
```

## Options

:::tip
In addition to the following options, you can also use any configuration option from [Vite](https://vitejs.dev/config/). For example, `define` to define global variables, or `resolve.alias` to define aliases.
:::

### include

- **Type:** `string[]`
- **Default:** `['**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}']`

Files to include in the test run, using glob pattern.

### exclude

- **Type:** `string[]`
- **Default:** `['**/node_modules/**', '**/dist/**', '**/cypress/**', '**/.{idea,git,cache,output,temp}/**']`

Files to exclude from the test run, using glob pattern.

### deps

- **Type:** `{ external?, inline? }`

Handling for dependencies inlining or externalizing

#### deps.external

- **Type:** `(string | RegExp)[]`
- **Default:** `['**/node_modules/**', '**/dist/**']`

Externalize means that Vite will bypass the package to native Node. Externalized dependencies will not be applied Vite's transformers and resolvers, so they do not support HMR on reload. Typically, packages under `node_modules` are externalized.

#### deps.inline

- **Type:** `(string | RegExp)[] | true`
- **Default:** `[]`

Vite will process inlined modules. This could be helpful to handle packages that ship `.js` in ESM format (that Node can't handle).

If `true`, every dependency will be inlined. All dependencies, specified in [`ssr.noExternal`](https://vitejs.dev/guide/ssr.html#ssr-externals) will be inlined by default.

#### deps.fallbackCJS

- **Type** `boolean`
- **Default:** `false`

When a dependency is a valid ESM package, try to guess the cjs version based on the path. This might be helpful, if a dependency has the wrong ESM file.

This might potentially cause some misalignment if a package has different logic in ESM and CJS mode.

#### deps.registerNodeLoader

- **Type:** `boolean`
- **Default:** `false`

Use [experimental Node loader](https://nodejs.org/api/esm.html#loaders) to resolve imports inside `node_modules`, using Vite resolve algorithm.

If disabled, your `alias` and `<plugin>.resolveId` won't affect imports inside `node_modules` or `deps.external`.

#### deps.interopDefault

- **Type:** `boolean`
- **Default:** `true`

Interpret CJS module's default as named exports.

### alias

- **Type:** `Record<string, string> | Array<{ find: string | RegExp, replacement: string, customResolver?: ResolverFunction | ResolverObject }>`

Define custom aliases when running inside tests. They will be merged with aliases from `resolve.alias`.

### globals

- **Type:** `boolean`
- **Default:** `false`

By default, `vitest` does not provide global APIs for explicitness. If you prefer to use the APIs globally like Jest, you can pass the `--globals` option to CLI or add `globals: true` in the config.

```ts
// vite.config.ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
  },
})
```

To get TypeScript working with the global APIs, add `vitest/globals` to the `types` field in your `tsconfig.json`

```json
// tsconfig.json
{
  "compilerOptions": {
    "types": ["vitest/globals"]
  }
}
```

If you are already using [`unplugin-auto-import`](https://github.com/antfu/unplugin-vue-components) in your project, you can also use it directly for auto importing those APIs.

```ts
// vite.config.ts
import { defineConfig } from 'vitest/config'
import AutoImport from 'unplugin-auto-import/vite'

export default defineConfig({
  plugins: [
    AutoImport({
      imports: ['vitest'],
      dts: true, // generate TypeScript declaration
    }),
  ],
})
```

### environment

- **Type:** `'node' | 'jsdom' | 'happy-dom' | 'edge-runtime'`
- **Default:** `'node'`

The environment that will be used for testing. The default environment in Vitest
is a Node.js environment. If you are building a web application, you can use
browser-like environment through either [`jsdom`](https://github.com/jsdom/jsdom)
or [`happy-dom`](https://github.com/capricorn86/happy-dom) instead.
If you are building edge functions, you can use [`edge-runtime`](https://edge-runtime.vercel.app/packages/vm) environment

By adding a `@vitest-environment` docblock or comment at the top of the file,
you can specify another environment to be used for all tests in that file:

Docblock style:

```js
/**
 * @vitest-environment jsdom
 */

test('use jsdom in this test file', () => {
  const element = document.createElement('div')
  expect(element).not.toBeNull()
})
```

Comment style:

```js
// @vitest-environment happy-dom

test('use happy-dom in this test file', () => {
  const element = document.createElement('div')
  expect(element).not.toBeNull()
})
```

For compatibility with Jest, there is also a `@jest-environment`:

```js
/**
 * @jest-environment jsdom
 */

test('use jsdom in this test file', () => {
  const element = document.createElement('div')
  expect(element).not.toBeNull()
})
```

If you are running Vitest with [`--no-threads`](#threads) flag, your tests will be run in this order: `node`, `jsdom`, `happy-dom`. Meaning, that every test with the same environment is grouped together, but is still run sequentially.

### update

- **Type:** `boolean`
- **Default:** `false`

Update snapshot files. This will update all changed snapshots and delete obsolete ones.

### watch

- **Type:** `boolean`
- **Default:** `true`

Enable watch mode

### root

- **Type:** `string`

Project root

### reporters

- **Type:** `Reporter | Reporter[]`
- **Default:** `'default'`

Custom reporters for output. Reporters can be [a Reporter instance](https://github.com/vitest-dev/vitest/blob/main/packages/vitest/src/types/reporter.ts) or a string to select built in reporters:

  - `'default'` - collapse suites when they pass
  - `'verbose'` - keep the full task tree visible
  - `'dot'` -  show each task as a single dot
  - `'junit'` - JUnit XML reporter
  - `'json'` -  give a simple JSON summary
  - path of a custom reporter (e.g. `'./path/to/reporter.ts'`, `'@scope/reporter'`)

### outputTruncateLength

- **Type:** `number`
- **Default:** `80`

Truncate output diff lines up to `80` number of characters. You may wish to tune this,
depending on you terminal window width.

### outputDiffLines

- **Type:** `number`
- **Default:** `15`

Limit number of output diff lines up to `15`.

### outputFile

- **Type:** `string | Record<string, string>`

Write test results to a file when the `--reporter=json` or `--reporter=junit` option is also specified.
By providing an object instead of a string you can define individual outputs when using multiple reporters.

To provide object via CLI command, use the following syntax: `--outputFile.json=./path --outputFile.junit=./other-path`.

### threads

- **Type:** `boolean`
- **Default:** `true`

Enable multi-threading using [tinypool](https://github.com/Aslemammad/tinypool) (a lightweight fork of [Piscina](https://github.com/piscinajs/piscina))

:::warning
This option is different from Jest's `--runInBand`. Vitest uses workers not only for running tests in parallel, but also to provide isolation. By disabling this option, your tests will run sequentially, but in the same global context, so you must provide isolation yourself.

This might cause all sorts of issues, if you are relying on global state (frontend frameworks usually do) or your code relies on environment to be defined separately for each test. But can be a speed boost for your tests (up to 3 times faster), that don't necessarily rely on global state or can easily bypass that.
:::

### maxThreads

- **Type:** `number`
- **Default:** _available CPUs_

Maximum number of threads. You can also use `VITEST_MAX_THREADS` environment variable.

### minThreads

- **Type:** `number`
- **Default:** _available CPUs_

Minimum number of threads. You can also use `VITEST_MIN_THREADS` environment variable.

### testTimeout

- **Type:** `number`
- **Default:** `5000`

Default timeout of a test in milliseconds

### hookTimeout

- **Type:** `number`
- **Default:** `10000`

Default timeout of a hook in milliseconds

### teardownTimeout

- **Type:** `number`
- **Default:** `1000`

Default timeout to wait for close when Vitest shuts down, in milliseconds

### silent

- **Type:** `boolean`
- **Default:** `false`

Silent console output from tests

### setupFiles

- **Type:** `string | string[]`

Path to setup files. They will be run before each test file.

You can use `process.env.VITEST_POOL_ID` (integer-like string) inside to distinguish between threads (will always be `'1'`, if run with `threads: false`).

:::tip
Note, that if you are running [`--no-threads`](#threads), this setup file will be run in the same global scope multiple times. Meaning, that you are accessing the same global object before each test, so make sure you are not doing the same thing more than you need.
:::

For example, you may rely on a global variable:

```ts
import { config } from '@some-testing-lib'

if (!globalThis.defined) {
  config.plugins = [myCoolPlugin]
  computeHeavyThing()
  globalThis.defined = true
}

// hooks are reset before each suite
afterEach(() => {
  cleanup()
})

globalThis.resetBeforeEachTest = true
```

### globalSetup

- **Type:** `string | string[]`

Path to global setup files, relative to project root

A global setup file can either export named functions `setup` and `teardown` or a `default` function that returns a teardown function ([example](https://github.com/vitest-dev/vitest/blob/main/test/global-setup/vitest.config.ts)).

::: info
Multiple globalSetup files are possible. setup and teardown are executed sequentially with teardown in reverse order.
:::

::: warning
Beware that the global setup is run in a different global scope, so your tests don't have access to variables defined here.
:::


### watchExclude

- **Type:** `string[]`
- **Default:** `['**/node_modules/**', '**/dist/**']`

Glob pattern of file paths to be ignored from triggering watch rerun.

### forceRerunTriggers

- **Type**: `string[]`
- **Default:** `['**/package.json/**', '**/vitest.config.*/**', '**/vite.config.*/**']`

Glob pattern of file paths that will trigger the whole suite rerun. When paired with the `--changed` argument will run the whole test suite if the trigger is found in the git diff.

Useful if you are testing calling CLI commands, because Vite cannot construct a module graph:

```ts
test('execute a script', async () => {
  // Vitest cannot rerun this test, if content of `dist/index.js` changes
  await execa('node', ['dist/index.js'])
})
```

::: tip
Make sure that your files are not excluded by `watchExclude`.
:::

### isolate

- **Type:** `boolean`
- **Default:** `true`

Isolate environment for each test file. Does not work if you disable [`--threads`](#threads).

### coverage

- **Type:** `CoverageC8Options | CoverageIstanbulOptions`
- **Default:** `undefined`

You can use [`c8`](https://github.com/bcoe/c8) or [`istanbul`](https://istanbul.js.org/) for coverage collection.

#### provider

- **Type:** `'c8' | 'istanbul'`
- **Default:** `'c8'`

Use `provider` to select the tool for coverage collection.

#### CoverageC8Options

Used when `provider: 'c8'` is set. Coverage options are passed to [`c8`](https://github.com/bcoe/c8).

#### CoverageIstanbulOptions

Used when `provider: 'istanbul'` is set.

##### exclude

- **Type:** `string[]`
- **Default:** `[]`

List of files excluded from coverage as glob patterns.

##### skipFull

- **Type:** `boolean`
- **Default:** `false`

Do not show files with 100% statement, branch, and function coverage.

##### perFile

- **Type:** `boolean`
- **Default:** `false`

Check thresholds per file.

##### lines

- **Type:** `number`

Threshold for lines.

##### functions

- **Type:** `number`

Threshold for functions.

##### branches

- **Type:** `number`

Threshold for branches.

##### statements

- **Type:** `number`

Threshold for statements.

##### ignoreClassMethods

- **Type:** `string[]`
- **Default:** []

Set to array of class method names to ignore for coverage.

##### watermarks

- **Type:**
<!-- eslint-skip -->
```ts
{
  statements?: [number, number],
  functions?: [number, number],
  branches?: [number, number],
  lines?: [number, number]
}
```

- **Default:**
<!-- eslint-skip -->
```ts
{
  statements: [50, 80],
  functions: [50, 80],
  branches: [50, 80],
  lines: [50, 80]
}
```

Watermarks for statements, lines, branches and functions.

### testNamePattern

- **Type** `string | RegExp`

Run tests with full names matching the pattern.
If you add `OnlyRunThis` to this property, tests not containing the word `OnlyRunThis` in the test name will be skipped.

```js
import { expect, test } from 'vitest'

// run
test('OnlyRunThis', () => {
  expect(true).toBe(true)
})

// skipped
test('doNotRun', () => {
  expect(true).toBe(true)
})
```

### open

- **Type:** `boolean`
- **Default:** `false`

Open Vitest UI (WIP)

### api

- **Type:** `boolean | number`
- **Default:** `false`

Listen to port and serve API. When set to true, the default port is 51204

### clearMocks

- **Type:** `boolean`
- **Default:** `false`

Will call [`.mockClear()`](/api/#mockclear) on all spies before each test. This will clear mock history, but not reset its implementation to the default one.

### mockReset

- **Type:** `boolean`
- **Default:** `false`

Will call [`.mockReset()`](/api/#mockreset) on all spies before each test. This will clear mock history and reset its implementation to an empty function (will return `undefined`).

### restoreMocks

- **Type:** `boolean`
- **Default:** `false`

Will call [`.mockRestore()`](/api/#mockrestore) on all spies before each test. This will clear mock history and reset its implementation to the original one.

### transformMode

- **Type:** `{ web?, ssr? }`

Determine the transform method of modules

#### transformMode.ssr

- **Type:** `RegExp[]`
- **Default:** `[/\.([cm]?[jt]sx?|json)$/]`

Use SSR transform pipeline for the specified files.<br>
Vite plugins will receive `ssr: true` flag when processing those files.

#### transformMode&#46;web

- **Type:** `RegExp[]`
- **Default:** *modules other than those specified in `transformMode.ssr`*

First do a normal transform pipeline (targeting browser), then do a SSR rewrite to run the code in Node.<br>
Vite plugins will receive `ssr: false` flag when processing those files.

When you use JSX as component models other than React (e.g. Vue JSX or SolidJS), you might want to config as following to make `.tsx` / `.jsx` transformed as client-side components:

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    transformMode: {
      web: [/\.[jt]sx$/],
    },
  },
})
```

### snapshotFormat

- **Type:** `PrettyFormatOptions`

Format options for snapshot testing. These options are passed down to [`pretty-format`](https://www.npmjs.com/package/pretty-format).

### resolveSnapshotPath

- **Type**: `(testPath: string, snapExtension: string) => string`
- **Default**: stores snapshot files in `__snapshots__` directory

Overrides default snapshot path. For example, to store snapshots next to test files:

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    resolveSnapshotPath: (testPath, snapExtension) => testPath + snapExtension,
  },
})
```

### allowOnly

- **Type**: `boolean`
- **Default**: `false`

Allow tests and suites that are marked as only.

### dangerouslyIgnoreUnhandledErrors

- **Type**: `boolean`
- **Default**: `false`

Ignore any unhandled errors that occur.

### passWithNoTests

- **Type**: `boolean`
- **Default**: `false`

Vitest will not fail, if no tests will be found.

### logHeapUsage

- **Type**: `boolean`
- **Default**: `false`

Show heap usage after each test. Useful for debugging memory leaks.

### css

- **Type**: `boolean | { include?, exclude? }`

Configure if CSS should be processed. When excluded, CSS files will be replaced with empty strings to bypass the subsequent processing.

By default, processes only CSS Modules, because it affects runtime. JSDOM and Happy DOM don't fully support injecting CSS, so disabling this setting might help with performance.

#### css.include

- **Type**: `RegExp | RegExp[]`
- **Default**: `[/\.module\./]`

RegExp pattern for files that should return actual CSS and will be processed by Vite pipeline.

#### css.exclude

- **Type**: `RegExp | RegExp[]`
- **Default**: `[]`

RegExp pattern for files that will return an empty CSS file.

### maxConcurrency

- **Type**: `number`
- **Default**: `5`

A number of tests that are allowed to run at the same time marked with `test.concurrent`.

Test above this limit will be queued to run when available slot appears.

### cache

- **Type**: `false | { dir? }`

Options to configure Vitest cache policy. At the moment Vitest stores cache for test results to run the longer and failed tests first.

#### cache.dir

- **Type**: `string`
- **Default**: `node_modules/.vitest`

Path to cache directory.

### sequence

- **Type**: `{ sequencer?, shuffle?, seed? }`

Options for how tests should be sorted.

#### sequence.sequencer

- **Type**: `TestSequencerConstructor`
- **Default**: `BaseSequencer`

A custom class that defines methods for sharding and sorting. You can extend `BaseSequencer` from `vitest/node`, if you only need to redefine one of the `sort` and `shard` methods, but both should exist.

Sharding is happening before sorting, and only if `--shard` option is provided.

#### sequence.shuffle

- **Type**: `boolean`
- **Default**: `false`

If you want tests to run randomly, you can enable it with this option, or CLI argument [`--sequence.shuffle`](/guide/cli).

Vitest usually uses cache to sort tests, so long running tests start earlier - this makes tests run faster. If your tests will run in random order you will lose this performance improvement, but it may be useful to track tests that accidentally depend on another run previously.

#### sequence.seed

- **Type**: `number`
- **Default**: `Date.now()`

Sets the randomization seed, if tests are running in random order.
