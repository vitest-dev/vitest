---
outline: deep
---

# Configuring Vitest

## Configuration

`vitest` will read your root `vite.config.ts` when it is present to match with the plugins and setup as your Vite app. If you want to have a different configuration for testing or your main app doesn't rely on Vite specifically, you could either:

- Create `vitest.config.ts`, which will have the higher priority and will override the configuration from `vite.config.ts`
- Pass `--config` option to CLI, e.g. `vitest --config ./path/to/vitest.config.ts`
- Use `process.env.VITEST` or `mode` property on `defineConfig` (will be set to `test`/`benchmark` if not overridden) to conditionally apply different configuration in `vite.config.ts`

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

When using a separate `vitest.config.js`, you can also extend Vite's options from another config file if needed:

```ts
import { mergeConfig } from 'vite'
import { defineConfig } from 'vitest/config'
import viteConfig from './vite.config'

export default mergeConfig(viteConfig, defineConfig({
  test: {
    exclude: ['packages/template/*'],
  },
}))
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
- **Default:** `['**/node_modules/**', '**/dist/**', '**/cypress/**', '**/.{idea,git,cache,output,temp}/**', '**/{karma,rollup,webpack,vite,vitest,jest,ava,babel,nyc,cypress,tsup,build}.config.*']`

Files to exclude from the test run, using glob pattern.

### deps

- **Type:** `{ external?, inline?, ... }`

Handling for dependencies resolution.

#### deps.experimentalOptimizer

- **Type:** `DepOptimizationConfig & { enabled: boolean }`
- **Version:** Vitets 0.29.0
- **See also:** [Dep Optimization Options](https://vitejs.dev/config/dep-optimization-options.html)

Enable dependency optimization. If you have a lot of tests, this might improve their performance.

For `jsdom` and `happy-dom` environments, when Vitest will encounter the external library, it will be bundled into a single file using esbuild and imported as a whole module. This is good for several reasons:

- Importing packages with a lot of imports is expensive. By bundling them into one file we can save a lot of time
- Importing UI libraries is expensive because they are not meant to run inside Node.js
- Your `alias` configuration is now respected inside bundled packages

You can opt-out of this behavior for certain packages with `exclude` option. You can read more about available options in [Vite](https://vitejs.dev/config/dep-optimization-options.html) docs.

This options also inherits your `optimizeDeps` configuration. If you redefine `include`/`exclude`/`entries` option in `deps.experimentalOptimizer` it will overwrite your `optimizeDeps` when running tests.

::: tip
You will not be able to edit your `node_modules` code for debugging, since the code is actually located in your `cacheDir` or `test.cache.dir` directory. If you want to debug with `console.log` statements, edit it directly or force rebundling with `deps.experimentalOptimizer.force` option.
:::

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

Use [experimental Node loader](https://nodejs.org/api/esm.html#loaders) to resolve imports inside externalized files, using Vite resolve algorithm.

If disabled, your `alias` and `<plugin>.resolveId` won't affect imports inside externalized packages (by default, `node_modules`).

#### deps.interopDefault

- **Type:** `boolean`
- **Default:** `true`

Interpret CJS module's default as named exports. Some dependencies only bundle CJS modules and don't use named exports that Node.js can statically analyze when a package is imported using `import` syntax instead of `require`. When importing such dependencies in Node environment using named exports, you will see this error:

```
import { read } from 'fs-jetpack';
         ^^^^
SyntaxError: Named export 'read' not found. The requested module 'fs-jetpack' is a CommonJS module, which may not support all module.exports as named exports.
CommonJS modules can always be imported via the default export.
```

Vitest doesn't do static analysis, and cannot fail before your running code, so you will most likely see this error when running tests, if this feature is disabled:

```
TypeError: createAsyncThunk is not a function
TypeError: default is not a function
```

By default, Vitest assumes you are using a bundler to bypass this and will not fail, but you can disable this behaviour manually, if you code is not processed.

### runner

- **Type**: `VitestRunnerConstructor`
- **Default**: `node`, when running tests, or `benchmark`, when running benchmarks

Path to a custom test runner. This is an advanced feature and should be used with custom library runners. You can read more about it in [the documentation](/advanced/runner).

### benchmark

- **Type:** `{ include?, exclude?, ... }`

Options used when running `vitest bench`.

#### benchmark.include

- **Type:** `string[]`
- **Default:** `['**/*.{bench,benchmark}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}']`

Include globs for benchmark test files

#### benchmark.exclude

- **Type:** `string[]`
- **Default:** `['node_modules', 'dist', '.idea', '.git', '.cache']`

Exclude globs for benchmark test files

#### benchmark.includeSource

- **Type:** `string[]`
- **Default:** `[]`

Include globs for in-source benchmark test files. This option is similar to [`includeSource`](#includesource).

When defined, Vitest will run all matched files with `import.meta.vitest` inside.

#### benchmark.reporters

- **Type:** `Arrayable<BenchmarkBuiltinReporters | Reporter>`
- **Default:** `'default'`

Custom reporter for output. Can contain one or more built-in report names, reporter instances, and/or paths to custom reporters.

#### benchmark.outputFile

- **Type:** `string | Record<string, string>`

Write benchmark results to a file when the `--reporter=json` option is also specified.
By providing an object instead of a string you can define individual outputs when using multiple reporters.

To provide object via CLI command, use the following syntax: `--outputFile.json=./path --outputFile.junit=./other-path`.

### alias

- **Type:** `Record<string, string> | Array<{ find: string | RegExp, replacement: string, customResolver?: ResolverFunction | ResolverObject }>`

Define custom aliases when running inside tests. They will be merged with aliases from `resolve.alias`.

### globals

- **Type:** `boolean`
- **Default:** `false`
- **CLI:** `--globals`, `--globals=false`

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

If you are already using [`unplugin-auto-import`](https://github.com/antfu/unplugin-auto-import) in your project, you can also use it directly for auto importing those APIs.

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

- **Type:** `'node' | 'jsdom' | 'happy-dom' | 'edge-runtime' | string`
- **Default:** `'node'`
- **CLI:** `--environment=<env>`

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

If you are running Vitest with [`--threads=false`](#threads) flag, your tests will be run in this order: `node`, `jsdom`, `happy-dom`, `edge-runtime`, `custom environments`. Meaning, that every test with the same environment is grouped together, but is still running sequentially.

Starting from 0.23.0, you can also define custom environment. When non-builtin environment is used, Vitest will try to load package `vitest-environment-${name}`. That package should export an object with the shape of `Environment`:

```ts
import type { Environment } from 'vitest'

export default <Environment>{
  name: 'custom',
  setup() {
    // custom setup
    return {
      teardown() {
        // called after all tests with this env have been run
      }
    }
  }
}
```

Vitest also exposes `builtinEnvironments` through `vitest/environments` entry, in case you just want to extend it. You can read more about extending environments in [our guide](/guide/environment).

### environmentOptions

- **Type:** `Record<'jsdom' | string, unknown>`
- **Default:** `{}`

These options are passed down to `setup` method of current [`environment`](#environment). By default, you can configure only JSDOM options, if you are using it as your test environment.

### environmentMatchGlobs

- **Type:** `[string, EnvironmentName][]`
- **Default:** `[]`

Automatically assign environment based on globs. The first match will be used.

For example:

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environmentMatchGlobs: [
      // all tests in tests/dom will run in jsdom
      ['tests/dom/**', 'jsdom'],
      // all tests in tests/ with .edge.test.ts will run in edge-runtime
      ['**\/*.edge.test.ts', 'edge-runtime'],
      // ...
    ]
  }
})
```

### update

- **Type:** `boolean`
- **Default:** `false`
- **CLI:** `-u`, `--update`, `--update=false`

Update snapshot files. This will update all changed snapshots and delete obsolete ones.

### watch

- **Type:** `boolean`
- **Default:** `true`
- **CLI:** `-w`, `--watch`, `--watch=false`

Enable watch mode

### root

- **Type:** `string`
- **CLI:** `-r <path>`, `--root=<path>`

Project root

### reporters

- **Type:** `Reporter | Reporter[]`
- **Default:** `'default'`
- **CLI:** `--reporter=<name>`, `--reporter=<name1> --reporter=<name2>`

Custom reporters for output. Reporters can be [a Reporter instance](https://github.com/vitest-dev/vitest/blob/main/packages/vitest/src/types/reporter.ts) or a string to select built in reporters:

  - `'default'` - collapse suites when they pass
  - `'basic'` - give a reporter like default reporter in ci
  - `'verbose'` - keep the full task tree visible
  - `'dot'` -  show each task as a single dot
  - `'junit'` - JUnit XML reporter (you can configure `testsuites` tag name with `VITEST_JUNIT_SUITE_NAME` environmental variable)
  - `'json'` -  give a simple JSON summary
  - `'html'` -  outputs HTML report based on [`@vitest/ui`](/guide/ui)
  - `'hanging-process'` - displays a list of hanging processes, if Vitest cannot exit process safely. This might be a heavy operation, enable it only if Vitest consistently cannot exit process
  - path of a custom reporter (e.g. `'./path/to/reporter.ts'`, `'@scope/reporter'`)

### outputTruncateLength

- **Type:** `number`
- **Default:** `stdout.columns || 80`
- **CLI:** `--outputTruncateLength=<length>`, `--output-truncate-length=<length>`

Truncate the size of diff line up to `stdout.columns` or `80` number of characters. You may wish to tune this, depending on your terminal window width. Vitest includes `+-` characters and spaces for this. For example, you might see this diff, if you set this to `6`:

```diff
// actual line: "Text that seems correct"
- Text...
+ Test...
```

### outputDiffLines

- **Type:** `number`
- **Default:** `15`
- **CLI:** `--outputDiffLines=<lines>`, `--output-diff-lines=<lines>`

Limit the number of single output diff lines up to `15`. Vitest counts all `+-` lines when determining when to stop. For example, you might see diff like this, if you set this property to `3`:

```diff
- test: 1,
+ test: 2,
- obj: '1',
...
- test2: 1,
+ test2: 1,
- obj2: '2',
...
```

### outputDiffMaxLines

- **Type:** `number`
- **Default:** `50`
- **CLI:** `--outputDiffMaxLines=<lines>`, `--output-diff-max-lines=<lines>`
- **Version:** Since Vitest 0.26.0

The maximum number of lines to display in diff window. Beware that if you have a large object with many small diffs, you might not see all of them at once.

### outputDiffMaxSize

- **Type:** `number`
- **Default:** `10000`
- **CLI:** `--outputDiffMaxSize=<length>`, `--output-diff-max-size=<length>`
- **Version:** Since Vitest 0.26.0

The maximum length of the stringified object before the diff happens. Vitest tries to stringify an object before doing a diff, but if the object is too large, it will reduce the depth of the object to fit within this limit. Because of this, if the object is too big or nested, you might not see the diff.

Increasing this limit can increase the duration of diffing.

### outputFile

- **Type:** `string | Record<string, string>`
- **CLI:** `--outputFile=<path>`, `--outputFile.json=./path`

Write test results to a file when the `--reporter=json`, `--reporter=html` or `--reporter=junit` option is also specified.
By providing an object instead of a string you can define individual outputs when using multiple reporters.

### threads

- **Type:** `boolean`
- **Default:** `true`
- **CLI:** `--threads`, `--threads=false`

Enable multi-threading using [tinypool](https://github.com/tinylibs/tinypool) (a lightweight fork of [Piscina](https://github.com/piscinajs/piscina)). Prior to Vitest 0.29.0, Vitest was still running tests inside worker thread, even if this option was disabled. Since 0.29.0, if this option is disabled, Vitest uses `child_process` to spawn a process to run tests inside, meaning you can use `process.chdir` and other API that was not available inside workers. If you want to revert to the previous behaviour, use `--single-thread` option instead.

Disabling this option also disables module isolation, meaning all tests with the same environment are running inside a single child process.

### singleThread

- **Type:** `boolean`
- **Default:** `false`
- **Version:** Since Vitest 0.29.0

Run all tests with the same environment inside a single worker thread. This will disable built-in module isolation (your source code or [inlined](#deps-inline) code will still be reevaluated for each test), but can improve test performance. Before Vitest 0.29.0 this was equivalent to using `--no-threads`.


:::warning
Even though this option will force tests to run one after another, this option is different from Jest's `--runInBand`. Vitest uses workers not only for running tests in parallel, but also to provide isolation. By disabling this option, your tests will run sequentially, but in the same global context, so you must provide isolation yourself.

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

### useAtomics

- **Type:** `boolean`
- **Default:** `false`
- **Version:** Since Vitest 0.28.3

Use Atomics to synchronize threads.

This can improve performance in some cases, but might cause segfault in older Node versions.

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
- **Default:** `10000`

Default timeout to wait for close when Vitest shuts down, in milliseconds

### silent

- **Type:** `boolean`
- **Default:** `false`
- **CLI:** `--silent`, `--silent=false`

Silent console output from tests

### setupFiles

- **Type:** `string | string[]`

Path to setup files. They will be run before each test file.

:::info
Changing setup files will trigger rerun of all tests.
:::

You can use `process.env.VITEST_POOL_ID` (integer-like string) inside to distinguish between threads (will always be `'1'`, if run with `threads: false`).

:::tip
Note, that if you are running [`--threads=false`](#threads), this setup file will be run in the same global scope multiple times. Meaning, that you are accessing the same global object before each test, so make sure you are not doing the same thing more than you need.
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
- **CLI:** `--isolate`, `--isolate=false`

Isolate environment for each test file. Does not work if you disable [`--threads`](#threads).

### coverage

You can use [`c8`](https://github.com/bcoe/c8), [`istanbul`](https://istanbul.js.org/)  or [a custom coverage solution](/guide/coverage#custom-coverage-provider) for coverage collection.

You can provide coverage options to CLI with dot notation:

```sh
npx vitest --coverage.enabled --coverage.provider=istanbul --coverage.all
```

::: warning
If you are using coverage options with dot notation, don't forget to specify `--coverage.enabled`. Do not provide a single `--coverage` option in that case.
:::

#### coverage.provider

- **Type:** `'c8' | 'istanbul' | 'custom'`
- **Default:** `'c8'`
- **CLI:** `--coverage.provider=<provider>`

Use `provider` to select the tool for coverage collection.

#### coverage.enabled

- **Type:** `boolean`
- **Default:** `false`
- **Available for providers:** `'c8' | 'istanbul'`
- **CLI:** `--coverage.enabled`, `--coverage.enabled=false`

Enables coverage collection. Can be overridden using `--coverage` CLI option.

#### coverage.include

- **Type:** `string[]`
- **Default:** `['**']`
- **Available for providers:** `'c8' | 'istanbul'`
- **CLI:** `--coverage.include=<path>`, `--coverage.include=<path1> --coverage.include=<path2>`

List of files included in coverage as glob patterns

#### coverage.extension

- **Type:** `string | string[]`
- **Default:** `['.js', '.cjs', '.mjs', '.ts', '.mts', '.cts', '.tsx', '.jsx', '.vue', '.svelte']`
- **Available for providers:** `'c8' | 'istanbul'`
- **CLI:** `--coverage.extension=<extension>`, `--coverage.extension=<extension1> --coverage.extension=<extension2>`

#### coverage.exclude

- **Type:** `string[]`
- **Default:**
```js
[
  'coverage/**',
  'dist/**',
  'packages/*/test{,s}/**',
  '**/*.d.ts',
  'cypress/**',
  'test{,s}/**',
  'test{,-*}.{js,cjs,mjs,ts,tsx,jsx}',
  '**/*{.,-}test.{js,cjs,mjs,ts,tsx,jsx}',
  '**/*{.,-}spec.{js,cjs,mjs,ts,tsx,jsx}',
  '**/__tests__/**',
  '**/{karma,rollup,webpack,vite,vitest,jest,ava,babel,nyc,cypress,tsup,build}.config.*',
  '**/.{eslint,mocha,prettier}rc.{js,cjs,yml}',
]
```
- **Available for providers:** `'c8' | 'istanbul'`
- **CLI:** `--coverage.exclude=<path>`, `--coverage.exclude=<path1> --coverage.exclude=<path2>`

List of files excluded from coverage as glob patterns.

#### coverage.all

- **Type:** `boolean`
- **Default:** `false`
- **Available for providers:** `'c8' | 'istanbul'`
- **CLI:** `--coverage.all`, --coverage.all=false`

Whether to include all files, including the untested ones into report.

#### coverage.clean

- **Type:** `boolean`
- **Default:** `true`
- **Available for providers:** `'c8' | 'istanbul'`
- **CLI:** `--coverage.clean`, `--coverage.clean=false`

Clean coverage results before running tests

#### coverage.cleanOnRerun

- **Type:** `boolean`
- **Default:** `true`
- **Available for providers:** `'c8' | 'istanbul'`
- **CLI:** `--coverage.cleanOnRerun`, `--coverage.cleanOnRerun=false`

Clean coverage report on watch rerun

#### coverage.reportsDirectory

- **Type:** `string`
- **Default:** `'./coverage'`
- **Available for providers:** `'c8' | 'istanbul'`
- **CLI:** `--coverage.reportsDirectory=<path>`

Directory to write coverage report to.

#### coverage.reporter

- **Type:** `string | string[] | [string, {}][]`
- **Default:** `['text', 'html', 'clover', 'json']`
- **Available for providers:** `'c8' | 'istanbul'`
- **CLI:** `--coverage.reporter=<reporter>`, `--coverage.reporter=<reporter1> --coverage.reporter=<reporter2>`

Coverage reporters to use. See [istanbul documentation](https://istanbul.js.org/docs/advanced/alternative-reporters/) for detailed list of all reporters. See [`@types/istanbul-reporter`](https://github.com/DefinitelyTyped/DefinitelyTyped/blob/276d95e4304b3670eaf6e8e5a7ea9e265a14e338/types/istanbul-reports/index.d.ts) for details about reporter specific options.

The reporter has three different types:

- A single reporter: `{ reporter: 'html' }`
- Multiple reporters without options: `{ reporter: ['html', 'json'] }`
- A single or multiple reporters with reporter options:
  <!-- eslint-skip -->
  ```ts
  {
    reporter: [
      ['lcov', { 'projectRoot': './src' }],
      ['json', { 'file': 'coverage.json' }],
      ['text']
    ]
  }
  ```

#### coverage.skipFull

- **Type:** `boolean`
- **Default:** `false`
- **Available for providers:** `'c8' | 'istanbul'`
- **CLI:** `--coverage.skipFull`, `--coverage.skipFull=false`

Do not show files with 100% statement, branch, and function coverage.

#### coverage.perFile

- **Type:** `boolean`
- **Default:** `false`
- **Available for providers:** `'c8' | 'istanbul'`
- **CLI:** `--coverage.perFile`, `--coverage.perFile=false`

Check thresholds per file.
See `lines`, `functions`, `branches` and `statements` for the actual thresholds.

#### coverage.thresholdAutoUpdate

- **Type:** `boolean`
- **Default:** `false`
- **Available for providers:** `'c8' | 'istanbul'`
- **CLI:** `--coverage.thresholdAutoUpdate=<boolean>`

Update threshold values `lines`, `functions`, `branches` and `statements` to configuration file when current coverage is above the configured thresholds.
This option helps to maintain thresholds when coverage is improved.

#### coverage.lines

- **Type:** `number`
- **Available for providers:** `'c8' | 'istanbul'`
- **CLI:** `--coverage.lines=<number>`

Threshold for lines.
See [istanbul documentation](https://github.com/istanbuljs/nyc#coverage-thresholds) for more information.

#### coverage.functions

- **Type:** `number`
- **Available for providers:** `'c8' | 'istanbul'`
- **CLI:** `--coverage.functions=<number>`

Threshold for functions.
See [istanbul documentation](https://github.com/istanbuljs/nyc#coverage-thresholds) for more information.

#### coverage.branches

- **Type:** `number`
- **Available for providers:** `'c8' | 'istanbul'`
- **CLI:** `--coverage.branches=<number>`

Threshold for branches.
See [istanbul documentation](https://github.com/istanbuljs/nyc#coverage-thresholds) for more information.

#### coverage.statements

- **Type:** `number`
- **Available for providers:** `'c8' | 'istanbul'`
- **CLI:** `--coverage.statements=<number>`

Threshold for statements.
See [istanbul documentation](https://github.com/istanbuljs/nyc#coverage-thresholds) for more information.

#### coverage.allowExternal

- **Type:** `boolean`
- **Default:** `false`
- **Available for providers:** `'c8'`
- **CLI:** `--coverage.allowExternal`, `--coverage.allowExternal=false`

Allow files from outside of your cwd.

#### coverage.excludeNodeModules

- **Type:** `boolean`
- **Default:** `true`
- **Available for providers:** `'c8'`
- **CLI:** `--coverage.excludeNodeModules`, `--coverage.excludeNodeModules=false`

Exclude coverage under `/node_modules/`.

#### coverage.src

- **Type:** `string[]`
- **Default:** `process.cwd()`
- **Available for providers:** `'c8'`
- **CLI:** `--coverage.src=<path>`

Specifies the directories that are used when `--all` is enabled.

#### coverage.100

- **Type:** `boolean`
- **Default:** `false`
- **Available for providers:** `'c8'`
- **CLI:** `--coverage.100`, `--coverage.100=false`

Shortcut for `--check-coverage --lines 100 --functions 100 --branches 100 --statements 100`.

#### coverage.ignoreClassMethods

- **Type:** `string[]`
- **Default:** `[]`
- **Available for providers:** `'istanbul'`
- **CLI:** `--coverage.ignoreClassMethods=<method>`

Set to array of class method names to ignore for coverage.
See [istanbul documentation](https://github.com/istanbuljs/nyc#ignoring-methods) for more information.

#### coverage.watermarks

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

- **Available for providers:** `'istanbul'`

Watermarks for statements, lines, branches and functions. See [istanbul documentation](https://github.com/istanbuljs/nyc#high-and-low-watermarks) for more information.

#### coverage.customProviderModule

- **Type:** `string`
- **Available for providers:** `'custom'`
- **CLI:** `--coverage.customProviderModule=<path or module name>`

Specifies the module name or path for the custom coverage provider module. See [Guide - Custom Coverage Provider](/guide/coverage#custom-coverage-provider) for more information.

### testNamePattern

- **Type** `string | RegExp`
- **CLI:** `-t <pattern>`, `--testNamePattern=<pattern>`, `--test-name-pattern=<pattern>`

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
- **CLI:** `--open`, `--open=false`

Open Vitest UI (WIP)

### api

- **Type:** `boolean | number`
- **Default:** `false`
- **CLI:** `--api`, `--api.port`, `--api.host`, `--api.strictPort`

Listen to port and serve API. When set to true, the default port is 51204

### clearMocks

- **Type:** `boolean`
- **Default:** `false`

Will call [`.mockClear()`](/api/mock#mockclear) on all spies before each test. This will clear mock history, but not reset its implementation to the default one.

### mockReset

- **Type:** `boolean`
- **Default:** `false`

Will call [`.mockReset()`](/api/mock#mockreset) on all spies before each test. This will clear mock history and reset its implementation to an empty function (will return `undefined`).

### restoreMocks

- **Type:** `boolean`
- **Default:** `false`

Will call [`.mockRestore()`](/api/mock#mockrestore) on all spies before each test. This will clear mock history and reset its implementation to the original one.

### unstubEnvs

- **Type:** `boolean`
- **Default:** `false`
- **Version:** Since Vitest 0.26.0

Will call [`vi.unstubAllEnvs`](/api/vi#vi-unstuballenvs) before each test.

### unstubGlobals

- **Type:** `boolean`
- **Default:** `false`
- **Version:** Since Vitest 0.26.0

Will call [`vi.unstubAllGlobals`](/api/vi#vi-unstuballglobals) before each test.

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
- **CLI:** `--allowOnly`, `--allowOnly=false`

Allow tests and suites that are marked as only.

### dangerouslyIgnoreUnhandledErrors

- **Type**: `boolean`
- **Default**: `false`
- **CLI:** `--dangerouslyIgnoreUnhandledErrors` `--dangerouslyIgnoreUnhandledErrors=false`

Ignore any unhandled errors that occur.

### passWithNoTests

- **Type**: `boolean`
- **Default**: `false`
- **CLI:** `--passWithNoTests`, `--passWithNoTests=false`

Vitest will not fail, if no tests will be found.

### logHeapUsage

- **Type**: `boolean`
- **Default**: `false`
- **CLI:** `--logHeapUsage`, `--logHeapUsage=false`

Show heap usage after each test. Useful for debugging memory leaks.

### css

- **Type**: `boolean | { include?, exclude?, modules? }`

Configure if CSS should be processed. When excluded, CSS files will be replaced with empty strings to bypass the subsequent processing. CSS Modules will return a proxy to not affect runtime.

#### css.include

- **Type**: `RegExp | RegExp[]`
- **Default**: `[]`

RegExp pattern for files that should return actual CSS and will be processed by Vite pipeline.

:::tip
To process all CSS files, use `/.+/`.
:::

#### css.exclude

- **Type**: `RegExp | RegExp[]`
- **Default**: `[]`

RegExp pattern for files that will return an empty CSS file.

#### css.modules

- **Type**: `{ classNameStrategy? }`
- **Default**: `{}`

#### css.modules.classNameStrategy

- **Type**: `'stable' | 'scoped' | 'non-scoped'`
- **Default**: `'stable'`

If you decide to process CSS files, you can configure if class names inside CSS modules should be scoped. You can choose one of the options:

- `stable`: class names will be generated as `_${name}_${hashedFilename}`, which means that generated class will stay the same, if CSS content is changed, but will change, if the name of the file is modified, or file is moved to another folder. This setting is useful, if you use snapshot feature.
- `scoped`: class names will be generated as usual, respecting `css.modules.generateScopeName` method, if you have one and CSS processing is enabled. By default, filename will be generated as `_${name}_${hash}`, where hash includes filename and content of the file.
- `non-scoped`: class names will not be hashed.

::: warning
By default, Vitest exports a proxy, bypassing CSS Modules processing. If you rely on CSS properties on your classes, you have to enable CSS processing using `include` option.
:::

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

- **Type**: `{ sequencer?, shuffle?, seed?, hooks? }`

Options for how tests should be sorted.

You can provide sequence options to CLI with dot notation:

```sh
npx vitest --sequence.shuffle --sequence.seed=1000
```

#### sequence.sequencer

- **Type**: `TestSequencerConstructor`
- **Default**: `BaseSequencer`

A custom class that defines methods for sharding and sorting. You can extend `BaseSequencer` from `vitest/node`, if you only need to redefine one of the `sort` and `shard` methods, but both should exist.

Sharding is happening before sorting, and only if `--shard` option is provided.

#### sequence.shuffle

- **Type**: `boolean`
- **Default**: `false`
- **CLI**: `--sequence.shuffle`, `--sequence.shuffle=false`

If you want tests to run randomly, you can enable it with this option, or CLI argument [`--sequence.shuffle`](/guide/cli).

Vitest usually uses cache to sort tests, so long running tests start earlier - this makes tests run faster. If your tests will run in random order you will lose this performance improvement, but it may be useful to track tests that accidentally depend on another run previously.

#### sequence.seed

- **Type**: `number`
- **Default**: `Date.now()`
- **CLI**: `--sequence.seed=1000`

Sets the randomization seed, if tests are running in random order.

#### sequence.hooks

- **Type**: `'stack' | 'list' | 'parallel'`
- **Default**: `'parallel'`
- **CLI**: `--sequence.hooks=<value>`

Changes the order in which hooks are executed.

- `stack` will order "after" hooks in reverse order, "before" hooks will run in the order they were defined
- `list` will order all hooks in the order they are defined
- `parallel` will run hooks in a single group in parallel (hooks in parent suites will still run before the current suite's hooks)

### typecheck

Options for configuring [typechecking](/guide/testing-types) test environment.

#### typecheck.checker

- **Type**: `'tsc' | 'vue-tsc' | string`
- **Default**: `tsc`

What tools to use for type checking. Vitest will spawn a process with certain parameters for easier parsing, depending on the type. Checker should implement the same output format as `tsc`.

You need to have a package installed to use typechecker:

- `tsc` requires `typescript` package
- `vue-tsc` requires `vue-tsc` package

You can also pass down a path to custom binary or command name that produces the same output as `tsc --noEmit --pretty false`.

#### typecheck.include

- **Type**: `string[]`
- **Default**: `['**/*.{test,spec}-d.{ts,js}']`

Glob pattern for files that should be treated as test files

#### typecheck.exclude

- **Type**: `string[]`
- **Default**: `['**/node_modules/**', '**/dist/**', '**/cypress/**', '**/.{idea,git,cache,output,temp}/**']`

Glob pattern for files that should not be treated as test files

#### typecheck.allowJs

- **Type**: `boolean`
- **Default**: `false`

Check JS files that have `@ts-check` comment. If you have it enabled in tsconfig, this will not overwrite it.

#### typecheck.ignoreSourceErrors

- **Type**: `boolean`
- **Default**: `false`

Do not fail, if Vitest found errors outside the test files. This will not show you non-test errors at all.

By default, if Vitest finds source error, it will fail test suite.

#### typecheck.tsconfig

- **Type**: `string`
- **Default**: _tries to find closest tsconfig.json_

Path to custom tsconfig, relative to the project root.

### slowTestThreshold

- **Type**: `number`
- **Default**: `300`

The number of milliseconds after which a test is considered slow and reported as such in the results.
