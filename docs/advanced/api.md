---
outline: [2, 3]
---

# Node API

::: warning
Vitest exposes experimental private API. Breaking changes might not follow SemVer, please pin Vitest's version when using it.
:::

## startVitest

You can start running Vitest tests using its Node API:

```js
import { startVitest } from 'vitest/node'

const vitest = await startVitest('test')

await vitest?.close()
```

`startVitest` function returns `Vitest` instance if tests can be started. It returns `undefined`, if one of the following occurs:

- Vitest didn't find the `vite` package (usually installed with Vitest)
- If coverage is enabled and run mode is "test", but the coverage package is not installed (`@vitest/coverage-v8` or `@vitest/coverage-istanbul`)
- If the environment package is not installed (`jsdom`/`happy-dom`/`@edge-runtime/vm`)

If `undefined` is returned or tests failed during the run, Vitest sets `process.exitCode` to `1`.

If watch mode is not enabled, Vitest will call `close` method.

If watch mode is enabled and the terminal supports TTY, Vitest will register console shortcuts.

You can pass down a list of filters as a second argument. Vitest will run only tests that contain at least one of the passed-down strings in their file path.

Additionally, you can use the third argument to pass in CLI arguments, which will override any test config options.

Alternatively, you can pass in the complete Vite config as the fourth argument, which will take precedence over any other user-defined options.

After running the tests, you can get the results from the `state.getFiles` API:

```ts
const vitest = await startVitest('test')

console.log(vitest.state.getFiles()) // [{ type: 'file', ... }]
```

Since Vitest 2.1, it is recommended to use the ["Reported Tasks" API](/advanced/reporters#reported-tasks) together with the `state.getFiles`. In the future, Vitest will return those objects directly:

```ts
const vitest = await startVitest('test')

const [fileTask] = vitest.state.getFiles()
const testFile = vitest.state.getReportedEntity(fileTask)
```

## createVitest

You can create Vitest instance yourself using `createVitest` function. It returns the same `Vitest` instance as `startVitest`, but it doesn't start tests and doesn't validate installed packages.

```js
import { createVitest } from 'vitest/node'

const vitest = await createVitest('test', {
  watch: false,
})
```

## parseCLI

You can use this method to parse CLI arguments. It accepts a string (where arguments are split by a single space) or a strings array of CLI arguments in the same format that Vitest CLI uses. It returns a filter and `options` that you can later pass down to `createVitest` or `startVitest` methods.

```ts
import { parseCLI } from 'vitest/node'

parseCLI('vitest ./files.ts --coverage --browser=chrome')
```

## Vitest

Vitest instance requires the current test mode. It can be either:

- `test` when running runtime tests
- `benchmark` when running benchmarks

### mode

#### test

Test mode will only call functions inside `test` or `it`, and throws an error when `bench` is encountered. This mode uses `include` and `exclude` options in the config to find test files.

#### benchmark

Benchmark mode calls `bench` functions and throws an error, when it encounters `test` or `it`. This mode uses `benchmark.include` and `benchmark.exclude` options in the config to find benchmark files.

### start

You can start running tests or benchmarks with `start` method. You can pass an array of strings to filter test files.

### `provide`

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

::: tip
This method is also available to [global setup files](/config/#globalsetup) for cases where you cannot use the public API:

```js
export default function setup({ provide }) {
  provide('wsPort', 3000)
}
```
:::

## TestProject <Version>2.2.0</Version>

- **Alias**: `WorkspaceProject` before 2.2.0

### name

The name is a unique string assigned by the user or interpreted by Vitest. If user did not provide a name, Vitest tries to load a `package.json` in the root of the project and takes the `name` property from there. If there is no `package.json`, Vitest uses the name of the folder by default. Inline projects use numbers as the name (converted to string).

::: code-group
```ts [node.js]
import { createVitest } from 'vitest/node'

const vitest = await createVitest('test')
vitest.projects.map(p => p.name) === [
  '@pkg/server',
  'utils',
  '2',
  'custom'
]
```
```ts [vitest.workspace.js]
export default [
  './packages/server', // has package.json with "@pkg/server"
  './utils', // doesn't have a package.json file
  {
    // doesn't customize the name
    test: {
      pool: 'threads',
    },
  },
  {
    // customized the name
    test: {
      name: 'custom',
    },
  },
]
```
:::

### vitest

`vitest` references the global [`vitest`](#vitest) process.

### serializedConfig

This is the test config that all tests will receive. Vitest [serializes config](https://github.com/vitest-dev/vitest/blob/main/packages/vitest/src/node/config/serializeConfig.ts) manually by removing all functions and properties that are not possible to serialize. Since this value is available in both tests and node, it is exported from the main entry point.

```ts
import type { SerializedConfig } from 'vitest'

const config: SerializedConfig = vitest.projects[0].serializedConfig
```

### globalConfig

The test config that `vitest` was initialized with. If this is the root project, `globalConfig` and `config` will reference the same object. This config is useful for values that cannot be set on the project level, like `coverage` or `reporters`.

```ts
import type { ResolvedConfig } from 'vitest/node'

vitest.config === vitest.projects[0].globalConfig
```

### config

This is the project's resolved test config.

### vite

This is project's `ViteDevServer`. All projects have their own Vite servers.

### browser

This value will be set only if tests are running in the browser. If `browser` is enabled, but tests didn't run yet, this will be `undefined`. If you need to check if the project supports browser tests, use `project.isBrowserSupported()` method.

::: warning
The browser API is even more experimental and doesn't follow SemVer. The browser API will be standardized separately from the rest of the APIs.
:::

### provide

A way to provide custom values to tests in addition to [`config.provide`](/config/#provide) field. All values are validated with [`structuredClone`](https://developer.mozilla.org/en-US/docs/Web/API/Window/structuredClone) before they are stored, but the values on `providedContext` themselves are not cloned.

::: code-group
```ts [node.js]
import { createVitest } from 'vitest/node'

const vitest = await createVitest('test')
const project = vitest.projects.find(p => p.name === 'custom')
project.provide('key', 'value')
await vitest.start()
```
```ts [test.spec.js]
import { inject } from 'vitest'
const value = inject('key')
```
:::

The values can be provided dynamicaly. Provided value in tests will be updated on their next run.

### getProvidedContext

This returns the context object. Every project also inherits the global context set by `vitest.provide`.

```ts
import { createVitest } from 'vitest/node'

const vitest = await createVitest('test')
vitest.provide('global', true)
const project = vitest.projects.find(p => p.name === 'custom')
project.provide('key', 'value')

// { global: true, key: 'value' }
const context = project.getProvidedContext()
```

::: tip
Project context values will always override global ones.
:::

### createSpecification

Create a test specification that can be used in `vitest.runFiles`. Specification scopes the test file to a specific `project` and `pool` (optionally).

```ts
import { createVitest } from 'vitest/node'
import { resolve } from 'node:path/posix'

const vitest = await createVitest('test')
const project = vitest.projects[0]
const specification = project.createSpecification(
  resolve('./basic.test.ts'),
  'threads', // optional override
)
await vitest.runFiles([specification], true)
```

::: warning
`createSpecification` expects an absolute file path. It doesn't resolve the file or check that it exists on the file system.
:::

### isRootProject

Checks if the current project is the root project. You can also get the root project by calling `vitest.getRootTestProject()`.

The root project generally doesn't run any tests and is not included in `vitest.projects` unless the user explicitly includes the root config in their workspace.

The primary goal of the root project is to setup the global config. In fact, `rootProject.config` references `rootProject.globalConfig` and `vitest.config` directly.

### globTestFiles

Globs all test files. This function returns an object with regular tests and typecheck tests:

```ts
interface GlobReturn {
  /**
   * Test files that match the filters.
   */
  testFiles: string[]
  /**
   * Typecheck test files that match the filters. This will be empty unless `typecheck.enabled` is `true`.
   */
  typecheckTestFiles: string[]
}
```

::: tip
Vitest uses [fast-glob](https://www.npmjs.com/package/fast-glob) to find test files. `test.dir`, `test.root`, `root` or `process.cwd()` define the `cwd` option.

This method looks at several config options:

- `test.include`, `test.exclude` to find regular test files
- `test.includeSource`, `test.exclude` to find in-source tests
- `test.typecheck.include`, `test.typecheck.exclude` to find typecheck tests
:::

### matchesTestGlob

This method checks if the file is a regular test file. It uses the same config properties that `globTestFiles` uses for validation.

This method also accepts a second parameter, which is the source code. This is used to validate if the file is an in-source test. If you are calling this method several times for several projects it is recommended to read the file once and pass it down directly.

```ts
import { createVitest } from 'vitest/node'
import { resolve } from 'node:path/posix'

const vitest = await createVitest('test')
const project = vitest.projects[0]

project.matchesTestGlob(resolve('./basic.test.ts')) // true
project.matchesTestGlob(resolve('./basic.ts')) // false
project.matchesTestGlob(resolve('./basic.ts'), `
if (import.meta.vitest) {
  // ...
}
`) // true if `includeSource` is set
```

### close

Closes the project and all associated resources. This can only be called once; the closing promise is cached until the server restarts. If the resources are needed again, create a new project.

In detail, this method closes the Vite server, stops the typechecker service, closes the browser if it's running, deletes the temporary directory that holds the source code, and resets the provided context.
