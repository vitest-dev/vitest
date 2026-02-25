---
title: Migration Guide | Guide
outline: deep
---

# Migration Guide

[Migrating to Vitest 3.0](https://v3.vitest.dev/guide/migration) | [Migrating to Vitest 2.0](https://v2.vitest.dev/guide/migration)

## Migrating to Vitest 4.0 {#vitest-4}

::: warning Prerequisites
Vitest 4.0 requires **Vite >= 6.0.0** and **Node.js >= 20.0.0**. Before proceeding
with any other migration steps, ensure your environment meets these requirements.
Running Vitest 4.0 on older versions of Vite or Node.js is not supported and may
result in unexpected errors.
:::

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

### Removed Options `coverage.all` and `coverage.extensions`

In previous versions Vitest included all uncovered files in coverage report by default.
This was due to `coverage.all` defaulting to `true`, and `coverage.include` defaulting to `**`.
These default values were chosen for a good reason - it is impossible for testing tools to guess where users are storing their source files.

This ended up having Vitest's coverage providers processing unexpected files, like minified Javascript, leading to slow/stuck coverage report generations.
In Vitest v4 we have removed `coverage.all` completely and <ins>**defaulted to include only covered files in the report**</ins>.

When upgrading to v4 it is recommended to define `coverage.include` in your configuration, and then start applying simple `coverage.exclude` patterns if needed.

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

### Simplified `exclude`

By default, Vitest now only excludes tests from `node_modules` and `.git` folders. This means that Vitest no longer excludes:

- `dist` and `cypress` folders
- `.idea`, `.cache`, `.output`, `.temp` folders
- config files like `rollup.config.js`, `prettier.config.js`, `ava.config.js` and so on

If you need to limit the directory where your tests files are located, use the [`test.dir`](/config/dir) option instead because it is more performant than excluding files:

```ts
import { configDefaults, defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    dir: './frontend/tests', // [!code ++]
  },
})
```

To restore the previous behaviour, specify old `excludes` manually:

```ts
import { configDefaults, defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    exclude: [
      ...configDefaults.exclude,
      '**/dist/**', // [!code ++]
      '**/cypress/**', // [!code ++]
      '**/.{idea,git,cache,output,temp}/**', // [!code ++]
      '**/{karma,rollup,webpack,vite,vitest,jest,ava,babel,nyc,cypress,tsup,build,eslint,prettier}.config.*' // [!code ++]
    ],
  },
})
```

### `spyOn` and `fn` Support Constructors

Previously, if you tried to spy on a constructor with `vi.spyOn`, you would get an error like `Constructor <name> requires 'new'`. Since Vitest 4, all mocks called with a `new` keyword construct the instance instead of calling `mock.apply`. This means that the mock implementation has to use either the `function` or the `class` keyword in these cases:

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

### Changes to Mocking

Alongside new features like supporting constructors, Vitest 4 creates mocks differently to address several module mocking issues that we received over the years. This release attempts to make module spies less confusing, especially when working with classes.

- `vi.fn().getMockName()` now returns `vi.fn()` by default instead of `spy`. This can affect snapshots with mocks - the name will be changed from `[MockFunction spy]` to `[MockFunction]`. Spies created with `vi.spyOn` will keep using the original name by default for better debugging experience
- `vi.restoreAllMocks` no longer resets the state of spies and only restores spies created manually with `vi.spyOn`, automocks are no longer affected by this function (this also affects the config option [`restoreMocks`](/config/restoremocks)). Note that `.mockRestore` will still reset the mock implementation and clear the state
- Calling `vi.spyOn` on a mock now returns the same mock
- `mock.settledResults` are now populated immediately on function invocation with an `'incomplete'` result. When the promise is finished, the type is changed according to the result.
- Automocked instance methods are now properly isolated, but share a state with the prototype. Overriding the prototype implementation will always affect instance methods unless the methods have a custom mock implementation of their own. Calling `.mockReset` on the mock also no longer breaks that inheritance.
```ts
import { AutoMockedClass } from './example.js'
const instance1 = new AutoMockedClass()
const instance2 = new AutoMockedClass()

instance1.method.mockReturnValue(42)

expect(instance1.method()).toBe(42)
expect(instance2.method()).toBe(undefined)

expect(AutoMockedClass.prototype.method).toHaveBeenCalledTimes(2)

instance1.method.mockReset()
AutoMockedClass.prototype.method.mockReturnValue(100)

expect(instance1.method()).toBe(100)
expect(instance2.method()).toBe(100)

expect(AutoMockedClass.prototype.method).toHaveBeenCalledTimes(4)
```
- Automocked methods can no longer be restored, even with a manual `.mockRestore`. Automocked modules with `spy: true` will keep working as before
- Automocked getters no longer call the original getter. By default, automocked getters now return `undefined`. You can keep using `vi.spyOn(object, name, 'get')` to spy on a getter and change its implementation
- The mock `vi.fn(implementation).mockReset()` now correctly returns the mock implementation in `.getMockImplementation()`
- `vi.fn().mock.invocationCallOrder` now starts with `1`, like Jest does, instead of `0`

### Standalone Mode with Filename Filter

To improve user experience, Vitest will now start running the matched files when [`--standalone`](/guide/cli#standalone) is used with filename filter.

```sh
# In Vitest v3 and below this command would ignore "math.test.ts" filename filter.
# In Vitest v4 the math.test.ts will run automatically.
$ vitest --standalone math.test.ts
```

This allows users to create re-usable `package.json` scripts for standalone mode.

::: code-group
```json [package.json]
{
  "scripts": {
    "test:dev": "vitest --standalone"
  }
}
```
```bash [CLI]
# Start Vitest in standalone mode, without running any files on start
$ pnpm run test:dev

# Run math.test.ts immediately
$ pnpm run test:dev math.test.ts
```
:::

### Replacing `vite-node` with [Module Runner](https://vite.dev/guide/api-environment-runtimes.html#modulerunner)

Module Runner is a successor to `vite-node` implemented directly in Vite. Vitest now uses it directly instead of having a wrapper around Vite SSR handler. This means that certain features are no longer available:

- `VITE_NODE_DEPS_MODULE_DIRECTORIES` environment variable was replaced with `VITEST_MODULE_DIRECTORIES`
- Vitest no longer injects `__vitest_executor` into every [test runner](/api/advanced/runner). Instead, it injects `moduleRunner` which is an instance of [`ModuleRunner`](https://vite.dev/guide/api-environment-runtimes.html#modulerunner)
- `vitest/execute` entry point was removed. It was always meant to be internal
- [Custom environments](/guide/environment) no longer need to provide a `transformMode` property. Instead, provide `viteEnvironment`. If it is not provided, Vitest will use the environment name to transform files on the server (see [`server.environments`](https://vite.dev/guide/api-environment-instances.html))
- `vite-node` is no longer a dependency of Vitest
- `deps.optimizer.web` was renamed to [`deps.optimizer.client`](/config/deps#deps-client). You can also use any custom names to apply optimizer configs when using other server environments

Vite has its own externalization mechanism, but we decided to keep using the old one to reduce the amount of breaking changes. You can keep using [`server.deps`](/config/server#deps) to inline or externalize packages.

This update should not be noticeable unless you rely on advanced features mentioned above.

### `workspace` is Replaced with `projects`

The `workspace` configuration option was renamed to [`projects`](/guide/projects) in Vitest 3.2. They are functionally the same, except you cannot specify another file as the source of your workspace (previously you could specify a file that would export an array of projects). Migrating to `projects` is easy, just move the code from `vitest.workspace.js` to `vitest.config.ts`:

::: code-group
```ts [vitest.config.js]
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    workspace: './vitest.workspace.js', // [!code --]
    projects: [ // [!code ++]
      './packages/*', // [!code ++]
      { // [!code ++]
        test: { // [!code ++]
          name: 'unit', // [!code ++]
        }, // [!code ++]
      }, // [!code ++]
    ] // [!code ++]
  }
})
```
```ts [vitest.workspace.js]
import { defineWorkspace } from 'vitest/config' // [!code --]

export default defineWorkspace([ // [!code --]
  './packages/*', // [!code --]
  { // [!code --]
    test: { // [!code --]
      name: 'unit', // [!code --]
    }, // [!code --]
  } // [!code --]
]) // [!code --]
```
:::

### Browser Provider Rework

In Vitest 4.0, the browser provider now accepts an object instead of a string (`'playwright'`, `'webdriverio'`). The `preview` is no longer a default. This makes it simpler to work with custom options and doesn't require adding `/// <reference` comments anymore.

```ts
import { playwright } from '@vitest/browser-playwright' // [!code ++]

export default defineConfig({
  test: {
    browser: {
      provider: 'playwright', // [!code --]
      provider: playwright({ // [!code ++]
        launchOptions: { // [!code ++]
          slowMo: 100, // [!code ++]
        }, // [!code ++]
      }), // [!code ++]
      instances: [
        {
          browser: 'chromium',
          launch: { // [!code --]
            slowMo: 100, // [!code --]
          }, // [!code --]
        },
      ],
    },
  },
})
```

The naming of properties in `playwright` factory now also aligns with [Playwright documentation](https://playwright.dev/docs/api/class-testoptions#test-options-launch-options) making it easier to find.

With this change, the `@vitest/browser` package is no longer needed, and you can remove it from your dependencies. To support the context import, you should update the `@vitest/browser/context` to `vitest/browser`:

```ts
import { page } from '@vitest/browser/context' // [!code --]
import { page } from 'vitest/browser' // [!code ++]

test('example', async () => {
  await page.getByRole('button').click()
})
```

The modules are identical, so doing a simple "Find and Replace" should be sufficient.

If you were using the `@vitest/browser/utils` module, you can now import those utilities from `vitest/browser` as well:

```ts
import { getElementError } from '@vitest/browser/utils' // [!code --]
import { utils } from 'vitest/browser' // [!code ++]
const { getElementError } = utils // [!code ++]
```

::: warning
Both `@vitest/browser/context` and `@vitest/browser/utils` work at runtime during the transition period, but they will be removed in a future release.
:::

### Pool Rework

Vitest has used [`tinypool`](https://github.com/tinylibs/tinypool) for orchestrating how test files are run in the test runner workers. Tinypool has controlled how complex tasks like parallelism, isolation and IPC communication works internally. However we've found that Tinypool has some flaws that are slowing down development of Vitest. In Vitest v4 we've completely removed Tinypool and rewritten how pools work without new dependencies. Read more about reasoning from [feat!: rewrite pools without tinypool #8705
](https://github.com/vitest-dev/vitest/pull/8705).

New pool architecture allows Vitest to simplify many previously complex configuration options:

- `maxThreads` and `maxForks` are now `maxWorkers`.
- Environment variables `VITEST_MAX_THREADS` and `VITEST_MAX_FORKS` are now `VITEST_MAX_WORKERS`.
- `singleThread` and `singleFork` are now `maxWorkers: 1, isolate: false`. If your tests were relying on module reset between tests, you'll need to add [setupFile](/config/setupfiles) that calls [`vi.resetModules()`](/api/vi.html#vi-resetmodules) in [`beforeAll` test hook](/api/hooks#beforeall).
- `poolOptions` is removed. All previous `poolOptions` are now top-level options. The `memoryLimit` of VM pools is renamed to `vmMemoryLimit`.
- `threads.useAtomics` is removed. If you have a use case for this, feel free to open a new feature request.
- Custom pool interface has been rewritten, see [Custom Pool](/guide/advanced/pool#custom-pool)

```ts
export default defineConfig({
  test: {
    poolOptions: { // [!code --]
      forks: { // [!code --]
        execArgv: ['--expose-gc'], // [!code --]
        isolate: false, // [!code --]
        singleFork: true, // [!code --]
      }, // [!code --]
      vmThreads: { // [!code --]
        memoryLimit: '300Mb' // [!code --]
      }, // [!code --]
    }, // [!code --]
    execArgv: ['--expose-gc'], // [!code ++]
    isolate: false, // [!code ++]
    maxWorkers: 1, // [!code ++]
    vmMemoryLimit: '300Mb', // [!code ++]
  }
})
```

Previously it was not possible to specify some pool related options per project when using [Vitest Projects](/guide/projects). With the new architecture this is no longer a blocker.

::: code-group
```ts [Isolation per project]
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    projects: [
      {
        // Non-isolated unit tests
        name: 'Unit tests',
        isolate: false,
        exclude: ['**.integration.test.ts'],
      },
      {
        // Isolated integration tests
        name: 'Integration tests',
        include: ['**.integration.test.ts'],
      },
    ],
  },
})
```
```ts [Parallel & Sequential projects]
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    projects: [
      {
        name: 'Parallel',
        exclude: ['**.sequential.test.ts'],
      },
      {
        name: 'Sequential',
        include: ['**.sequential.test.ts'],
        fileParallelism: false,
      },
    ],
  },
})
```
```ts [Node CLI options per project]
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    projects: [
      {
        name: 'Production env',
        execArgv: ['--env-file=.env.prod']
      },
      {
        name: 'Staging env',
        execArgv: ['--env-file=.env.staging']
      },
    ],
  },
})
```
:::

See [Recipes](/guide/recipes) for more examples.

### Reporter Updates

Reporter APIs `onCollected`, `onSpecsCollected`, `onPathsCollected`, `onTaskUpdate` and `onFinished` were removed. See [`Reporters API`](/api/advanced/reporters) for new alternatives. The new APIs were introduced in Vitest `v3.0.0`.

The `basic` reporter was removed as it is equal to:

```ts
export default defineConfig({
  test: {
    reporters: [
      ['default', { summary: false }]
    ]
  }
})
```

The [`verbose`](/guide/reporters#verbose-reporter) reporter now prints test cases as a flat list. To revert to the previous behaviour, use `--reporter=tree`:

```ts
export default defineConfig({
  test: {
    reporters: ['verbose'], // [!code --]
    reporters: ['tree'], // [!code ++]
  }
})
```

### Snapshots using Custom Elements Print the Shadow Root

In Vitest 4.0 snapshots that include custom elements will print the shadow root contents. To restore the previous behavior, set the [`printShadowRoot` option](/config/snapshotformat) to `false`.

```js{15-22}
// before Vitest 4.0
exports[`custom element with shadow root 1`] = `
"<body>
  <div>
    <custom-element />
  </div>
</body>"
`

// after Vitest 4.0
exports[`custom element with shadow root 1`] = `
"<body>
  <div>
    <custom-element>
      #shadow-root
        <span
          class="some-name"
          data-test-id="33"
          id="5"
        >
          hello
        </span>
    </custom-element>
  </div>
</body>"
`
```

### Deprecated APIs are Removed

Vitest 4.0 removes some deprecated APIs, including:

- `poolMatchGlobs` config option. Use [`projects`](/guide/projects) instead.
- `environmentMatchGlobs` config option. Use [`projects`](/guide/projects) instead.
- `deps.external`, `deps.inline`, `deps.fallbackCJS` config options. Use `server.deps.external`, `server.deps.inline`, or `server.deps.fallbackCJS` instead.
- `browser.testerScripts` config option. Use [`browser.testerHtmlPath`](/config/browser/testerhtmlpath) instead.
- `minWorkers` config option. Only `maxWorkers` has any effect on how tests are running, so we are removing this public option.
- Vitest no longer supports providing test options object as a third argument to `test` and `describe`. Use the second argument instead:

```ts
test('example', () => { /* ... */ }, { retry: 2 }) // [!code --]
test('example', { retry: 2 }, () => { /* ... */ }) // [!code ++]
```

Note that providing a timeout number as the last argument is still supported:

```ts
test('example', () => { /* ... */ }, 1000) // ✅
```

This release also removes all deprecated types. This finally fixes an issue where Vitest accidentally pulled in `@types/node` (see [#5481](https://github.com/vitest-dev/vitest/issues/5481) and [#6141](https://github.com/vitest-dev/vitest/issues/6141)).

## Migrating from Jest {#jest}

Vitest has been designed with a Jest compatible API, in order to make the migration from Jest as simple as possible. Despite those efforts, you may still run into the following differences:

### Globals as a Default

Jest has their [globals API](https://jestjs.io/docs/api) enabled by default. Vitest does not. You can either enable globals via [the `globals` configuration setting](/config/globals) or update your code to use imports from the `vitest` module instead.

If you decide to keep globals disabled, be aware that common libraries like [`testing-library`](https://testing-library.com/) will not run auto DOM [cleanup](https://testing-library.com/docs/svelte-testing-library/api/#cleanup).

### `mock.mockReset`

Jest's [`mockReset`](https://jestjs.io/docs/mock-function-api#mockfnmockreset) replaces the mock implementation with an
empty function that returns `undefined`.

Vitest's [`mockReset`](/api/mock#mockreset) resets the mock implementation to its original.
That is, resetting a mock created by `vi.fn(impl)` will reset the mock implementation to `impl`.

### `mock.mock` is Persistent

Jest will recreate the mock state when `.mockClear` is called, meaning you always need to access it as a getter. Vitest, on the other hand, holds a persistent reference to the state, meaning you can reuse it:

```ts
const mock = vi.fn()
const state = mock.mock
mock.mockClear()

expect(state).toBe(mock.mock) // fails in Jest
```

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

Unlike Jest, mocked modules in `<root>/__mocks__` are not loaded unless `vi.mock()` is called. If you need them to be mocked in every test, like in Jest, you can mock them inside [`setupFiles`](/config/setupfiles).

### Importing the Original of a Mocked Package

If you are only partially mocking a package, you might have previously used Jest's function `requireActual`. In Vitest, you should replace these calls with `vi.importActual`.

```ts
const { cloneDeep } = jest.requireActual('lodash/cloneDeep') // [!code --]
const { cloneDeep } = await vi.importActual('lodash/cloneDeep') // [!code ++]
```

### Extends mocking to external libraries

Where Jest does it by default, when mocking a module and wanting this mocking to be extended to other external libraries that use the same module, you should explicitly tell which 3rd-party library you want to be mocked, so the external library would be part of your source code, by using [server.deps.inline](/config/server#inline).

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

Just like Jest, Vitest sets `NODE_ENV` to `test`, if it wasn't set before. Vitest also has a counterpart for `JEST_WORKER_ID` called `VITEST_POOL_ID` (always less than or equal to `maxWorkers`), so if you rely on it, don't forget to rename it. Vitest also exposes `VITEST_WORKER_ID` which is a unique ID of a running worker - this number is not affected by `maxWorkers`, and will increase with each created worker.

### Replace property

If you want to modify the object, you will use [replaceProperty API](https://jestjs.io/docs/jest-object#jestreplacepropertyobject-propertykey-value) in Jest, you can use [`vi.stubEnv`](/api/vi#vi-stubenv) or [`vi.spyOn`](/api/vi#vi-spyon) to do the same also in Vitest.

### Done Callback

Vitest does not support the callback style of declaring tests. You can rewrite them to use `async`/`await` functions, or use Promise to mimic the callback style.

<!--@include: ./examples/promise-done.md-->

### Hooks

`beforeAll`/`beforeEach` hooks may return [teardown function](/api/hooks#beforeach) in Vitest. Because of that you may need to rewrite your hooks declarations, if they return something other than `undefined` or `null`:

```ts
beforeEach(() => setActivePinia(createTestingPinia())) // [!code --]
beforeEach(() => { setActivePinia(createTestingPinia()) }) // [!code ++]
```

In Jest hooks are called sequentially (one after another). By default, Vitest runs hooks in a stack. To use Jest's behavior, update [`sequence.hooks`](/config/sequence#sequence-hooks) option:

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

This is not a Jest-specific feature, but if you previously were using Jest with vue-cli preset, you will need to install [`jest-serializer-vue`](https://github.com/eddyerburgh/jest-serializer-vue) package, and specify it in [`snapshotSerializers`](/config/snapshotserializers):

```js [vitest.config.js]
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    snapshotSerializers: ['jest-serializer-vue']
  }
})
```

Otherwise your snapshots will have a lot of escaped `"` characters.

## Migrating from Mocha + Chai + Sinon {#mocha-chai-sinon}

Vitest provides excellent support for migrating from Mocha+Chai+Sinon test suites. While Vitest uses a Jest-compatible API by default, it also provides Chai-style assertions for spy/mock testing, making migration easier.

### Test Structure

Mocha and Vitest have similar test structures, but with some differences:

```ts
// Mocha
describe('suite', () => {
  before(() => { /* setup */ })
  after(() => { /* teardown */ })
  beforeEach(() => { /* setup */ })
  afterEach(() => { /* teardown */ })

  it('test', () => {
    // test code
  })
})

// Vitest - same structure works!
import { afterAll, afterEach, beforeAll, beforeEach, describe, it } from 'vitest'

describe('suite', () => {
  beforeAll(() => { /* setup */ })
  afterAll(() => { /* teardown */ })
  beforeEach(() => { /* setup */ })
  afterEach(() => { /* teardown */ })

  it('test', () => {
    // test code
  })
})
```

### Assertions

Vitest includes Chai assertions by default, so Chai assertions work without changes:

```ts
// Both Mocha+Chai and Vitest
import { expect } from 'vitest' // or 'chai' in Mocha

expect(value).to.equal(42)
expect(value).to.be.true
expect(array).to.have.lengthOf(3)
expect(obj).to.have.property('key')
```

### Spy/Mock Assertions

Vitest provides **Chai-style assertions** for spies and mocks, allowing you to migrate from Sinon without rewriting assertions:

```ts
// Before (Mocha + Chai + Sinon)
const sinon = require('sinon')
const chai = require('chai')
const sinonChai = require('sinon-chai')
chai.use(sinonChai)

const spy = sinon.spy(obj, 'method')
obj.method('arg1', 'arg2')

expect(spy).to.have.been.called
expect(spy).to.have.been.calledOnce
expect(spy).to.have.been.calledWith('arg1', 'arg2')

// After (Vitest) - same assertion syntax!
import { expect, vi } from 'vitest'

const spy = vi.spyOn(obj, 'method')
obj.method('arg1', 'arg2')

expect(spy).to.have.been.called
expect(spy).to.have.been.calledOnce
expect(spy).to.have.been.calledWith('arg1', 'arg2')
```

#### Complete Chai-Style Assertion Support

Vitest supports all common sinon-chai assertions:

| Sinon-Chai | Vitest | Description |
|------------|--------|-------------|
| `spy.called` | `called` | Spy was called at least once |
| `spy.calledOnce` | `calledOnce` | Spy was called exactly once |
| `spy.calledTwice` | `calledTwice` | Spy was called exactly twice |
| `spy.calledThrice` | `calledThrice` | Spy was called exactly three times |
| `spy.callCount(n)` | `callCount(n)` | Spy was called n times |
| `spy.calledWith(...)` | `calledWith(...)` | Spy was called with specific args |
| `spy.calledOnceWith(...)` | `calledOnceWith(...)` | Spy was called once with specific args |
| `spy.returned` | `returned` | Spy returned successfully |
| `spy.returnedWith(value)` | `returnedWith(value)` | Spy returned specific value |

See the [Chai-Style Spy Assertions](/api/expect#chai-style-spy-assertions) documentation for the complete list.

### Creating Spies and Mocks

Replace Sinon's spy/stub/mock creation with Vitest's `vi` utilities:

```ts
// Sinon
const sinon = require('sinon')
const spy = sinon.spy()
const stub = sinon.stub(obj, 'method')
const mock = sinon.mock(obj)

// Vitest
import { vi } from 'vitest'
const spy = vi.fn()
const stub = vi.spyOn(obj, 'method')
// Vitest doesn't have "mocks" - use spies instead
```

### Stubbing Return Values

```ts
// Sinon
stub.returns(42)
stub.onFirstCall().returns(1)
stub.onSecondCall().returns(2)

// Vitest
stub.mockReturnValue(42)
stub.mockReturnValueOnce(1)
stub.mockReturnValueOnce(2)
```

### Stubbing Implementations

```ts
// Sinon
stub.callsFake(arg => arg * 2)

// Vitest
stub.mockImplementation(arg => arg * 2)
```

### Restoring Spies

```ts
// Sinon
spy.restore()
sinon.restore() // restore all

// Vitest
spy.mockRestore()
vi.restoreAllMocks() // restore all
```

### Timers

Both Sinon and Vitest use `@sinonjs/fake-timers` internally:

```ts
// Sinon
const clock = sinon.useFakeTimers()
clock.tick(1000)
clock.restore()

// Vitest
import { vi } from 'vitest'
vi.useFakeTimers()
vi.advanceTimersByTime(1000)
vi.useRealTimers()
```

### Key Differences

1. **Globals**: Mocha provides globals by default. In Vitest, either import from `vitest` or enable [`globals`](/config/globals) config
2. **Assertion style**: You can use both Chai-style (`expect(spy).to.have.been.called`) and Jest-style (`expect(spy).toHaveBeenCalled()`)
3. **Parallel execution**: Vitest runs tests in parallel by default, Mocha runs sequentially

For more information, see:
- [Chai-Style Spy Assertions](/api/expect#chai-style-spy-assertions)
- [Mocking Guide](/guide/mocking)
- [Vi API](/api/vi)
