---
title: TestProject
---

# TestProject <Version>3.0.0</Version> {#testproject}

- **Alias**: `WorkspaceProject` before 3.0.0

::: warning
This guide describes the advanced Node.js API. If you just want to create a workspace, follow the ["Workspace"](/guide/workspace) guide.
:::

## name

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

::: info
If the [root project](/advanced/api/vitest#getroottestproject) is not part of a user workspace, its `name` will not be resolved.
:::

## vitest

`vitest` references the global [`Vitest`](/advanced/api/vitest) process.

## serializedConfig

This is the config that test processes receive. Vitest [serializes config](https://github.com/vitest-dev/vitest/blob/main/packages/vitest/src/node/config/serializeConfig.ts) manually by removing all functions and properties that are not possible to serialize. Since this value is available in both tests and node, its type is exported from the main entry point.

```ts
import type { SerializedConfig } from 'vitest'

const config: SerializedConfig = vitest.projects[0].serializedConfig
```

::: warning
The `serializedConfig` property is a getter. Every time it's accessed Vitest serializes the config again in case it was changed. This also means that it always returns a different reference:

```ts
project.serializedConfig === project.serializedConfig // ❌
```
:::

## globalConfig

The test config that [`Vitest`](/advanced/api/vitest) was initialized with. If this is the [root project](/advanced/api/vitest#getroottestproject), `globalConfig` and `config` will reference the same object. This config is useful for values that cannot be set on the project level, like `coverage` or `reporters`.

```ts
import type { ResolvedConfig } from 'vitest/node'

vitest.config === vitest.projects[0].globalConfig
```

## config

This is the project's resolved test config.

## vite

This is project's [`ViteDevServer`](https://vite.dev/guide/api-javascript#vitedevserver). All projects have their own Vite servers.

## browser

This value will be set only if tests are running in the browser. If `browser` is enabled, but tests didn't run yet, this will be `undefined`. If you need to check if the project supports browser tests, use `project.isBrowserEnabled()` method.

::: warning
The browser API is even more experimental and doesn't follow SemVer. The browser API will be standardized separately from the rest of the APIs.
:::

## provide

```ts
function provide<T extends keyof ProvidedContext & string>(
  key: T,
  value: ProvidedContext[T],
): void
```

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

::: tip
This method is also available to [global setup files](/config/#globalsetup) for cases where you cannot use the public API:

```js
export default function setup({ provide }) {
  provide('wsPort', 3000)
}
```
:::

## getProvidedContext

```ts
function getProvidedContext(): ProvidedContext
```

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
Project context values will always override root project's context.
:::

## createSpecification

```ts
function createSpecification(
  moduleId: string,
  locations?: number[],
): TestSpecification
```

Create a [test specification](/advanced/api/test-specification) that can be used in [`vitest.runTestSpecifications`](/advanced/api/vitest#runtestspecifications). Specification scopes the test file to a specific `project` and test `locations` (optional). Test [locations](/advanced/api/test-case#location) are code lines where the test is defined in the source code. If locations are provided, Vitest will only run tests defined on those lines. Note that if [`testNamePattern`](/config/#testnamepattern) is defined, then it will also be applied.

```ts
import { createVitest } from 'vitest/node'
import { resolve } from 'node:path/posix'

const vitest = await createVitest('test')
const project = vitest.projects[0]
const specification = project.createSpecification(
  resolve('./example.test.ts'),
  [20, 40], // optional test lines
)
await vitest.runTestSpecifications([specification])
```

::: warning
`createSpecification` expects resolved [module ID](/advanced/api/test-specification#moduleid). It doesn't auto-resolve the file or check that it exists on the file system.

Also note that `project.createSpecification` always returns a new instance.
:::

## isRootProject

```ts
function isRootProject(): boolean
```

Checks if the current project is the root project. You can also get the root project by calling [`vitest.getRootProject()`](#getrootproject).

## globTestFiles

```ts
function globTestFiles(filters?: string[]): {
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

Globs all test files. This function returns an object with regular tests and typecheck tests.

This method accepts `filters`. Filters can only a part of the file path, unlike in other methods on the [`Vitest`](/advanced/api/vitest) instance:

```js
project.globTestFiles(['foo']) // ✅
project.globTestFiles(['basic/foo.js:10']) // ❌
```

::: tip
Vitest uses [fast-glob](https://www.npmjs.com/package/fast-glob) to find test files. `test.dir`, `test.root`, `root` or `process.cwd()` define the `cwd` option.

This method looks at several config options:

- `test.include`, `test.exclude` to find regular test files
- `test.includeSource`, `test.exclude` to find in-source tests
- `test.typecheck.include`, `test.typecheck.exclude` to find typecheck tests
:::

## matchesTestGlob

```ts
function matchesTestGlob(
  moduleId: string,
  source?: () => string
): boolean
```

This method checks if the file is a regular test file. It uses the same config properties that `globTestFiles` uses for validation.

This method also accepts a second parameter, which is the source code. This is used to validate if the file is an in-source test. If you are calling this method several times for several projects it is recommended to read the file once and pass it down directly. If the file is not a test file, but matches the `includeSource` glob, Vitest will synchronously read the file unless the `source` is provided.

```ts
import { createVitest } from 'vitest/node'
import { resolve } from 'node:path/posix'

const vitest = await createVitest('test')
const project = vitest.projects[0]

project.matchesTestGlob(resolve('./basic.test.ts')) // true
project.matchesTestGlob(resolve('./basic.ts')) // false
project.matchesTestGlob(resolve('./basic.ts'), () => `
if (import.meta.vitest) {
  // ...
}
`) // true if `includeSource` is set
```

## import

<!--@include: ./import-example.md-->

Import a file using Vite module runner. The file will be transformed by Vite with provided project's config and executed in a separate context. Note that `moduleId` will be relative to the `config.root`.

::: danger
`project.import` reuses Vite's module graph, so importing the same module using a regular import will return a different module:

```ts
import * as staticExample from './example.js'
const dynamicExample = await project.import('./example.js')

dynamicExample !== staticExample // ✅
```
:::

::: info
Internally, Vitest uses this method to import global setups, custom coverage providers, workspace file, and custom reporters, meaning all of them share the same module graph as long as they belong to the same Vite server.
:::

## onTestsRerun

```ts
function onTestsRerun(cb: OnTestsRerunHandler): void
```

This is a shorthand for [`project.vitest.onTestsRerun`](/advanced/api/vitest#ontestsrerun). It accepts a callback that will be awaited when the tests have been scheduled to rerun (usually, due to a file change).

```ts
project.onTestsRerun((specs) => {
  console.log(specs)
})
```

## isBrowserEnabled

```ts
function isBrowserEnabled(): boolean
```

Returns `true` if this project runs tests in the browser.

## close

```ts
function close(): Promise<void>
```

Closes the project and all associated resources. This can only be called once; the closing promise is cached until the server restarts. If the resources are needed again, create a new project.

In detail, this method closes the Vite server, stops the typechecker service, closes the browser if it's running, deletes the temporary directory that holds the source code, and resets the provided context.
