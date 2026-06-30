---
title: Migration Guide | Guide
outline: deep
---

# Migration Guide

[Migrating to Vitest 4.0](https://v4.vitest.dev/guide/migration) | [Migrating to Vitest 3.0](https://v3.vitest.dev/guide/migration)

## Migrating to Vitest 5.0 {#vitest-5}

::: warning Work in progress
Vitest 5.0 is currently in beta. This section tracks breaking changes as they are merged and may change before the stable release.
:::

### `clearMocks` is Enabled by Default

[`clearMocks`](/config/#clearmocks) now defaults to `true`. Vitest calls [`vi.clearAllMocks()`](/api/vi#vi-clearallmocks) before every test, resetting the `mock.calls`, `mock.instances`, `mock.contexts` and `mock.results` of every mock. Mock implementations are left intact, so this only affects the recorded history.

In practice this means a mock no longer carries calls from one test into the next:

```ts
import { expect, test, vi } from 'vitest'

const fn = vi.fn()

test('first', () => {
  fn()
  expect(fn).toHaveBeenCalledTimes(1)
})

test('second', () => {
  fn()
  // v4: the call from "first" was kept, so this was 2 // [!code --]
  expect(fn).toHaveBeenCalledTimes(2) // [!code --]
  // v5: history is cleared before each test, so only this test's call counts // [!code ++]
  expect(fn).toHaveBeenCalledTimes(1) // [!code ++]
})
```

Tests that record calls outside of the test body (for example in a setup file, at the top level of a module, or in a `beforeAll` hook) are the most affected, because that history is cleared before the test that asserts on it runs.

To keep the previous behavior, set `clearMocks` back to `false`:

```ts [vitest.config.ts]
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    clearMocks: false, // [!code ++]
  },
})
```

### Benchmarking API Rewrite

The benchmarking API has been rewritten. `bench` is no longer a top-level import from `vitest`; it is a [test-context fixture](/guide/test-context#bench) accessed from inside a regular `test()`. See the [Benchmarking guide](/guide/benchmarking) for the new API.

Removed, with replacements where applicable:

- **`bench(name, fn)` at module scope**: destructure `bench` from the test context instead.

```ts
// v4
import { bench } from 'vitest' // [!code --]

bench('sort', () => { // [!code --]
  [3, 1, 2].sort() // [!code --]
}) // [!code --]

// v5
import { test } from 'vitest' // [!code ++]

test('sort', async ({ bench }) => { // [!code ++]
  await bench('sort', () => { [3, 1, 2].sort() }).run() // [!code ++]
}) // [!code ++]
```

- **`bench.skip`, `bench.only`, `bench.todo`** are removed. Use the regular `test.skip`, `test.only`, `test.todo` on the surrounding `test()` instead.
- **`benchmark.reporters` / `benchmark.outputFile`** are removed. Benchmark output is now part of the default reporter and the `json` reporter; configure those at the top level via `test.reporters` instead.
- **`benchmark.compare` config and the `--compare` CLI flag** are removed. Pass [`writeResult`](/guide/benchmarking#storing-and-replaying-results) as a per-bench option to persist a result, and read it back with [`bench.from()`](/guide/benchmarking#bench-from) inside `bench.compare()`.
- **`benchmark.outputJson` config and the `--outputJson` CLI flag** are removed. Use `--reporter=json --outputFile=<path>` to capture benchmark results; the JSON reporter now includes a `benchmarks` field on each test case.
- **`Vitest` instance `mode` property** is now always `'test'`. The previous `'benchmark'` value is no longer used; benchmarks run inside a dedicated project of the same `Vitest` instance.

### Vitest UI Requires an Authenticated URL

Vitest UI now requires token authentication for the HTML page and API access. The `/__vitest__/` URL will show an error until the browser is authenticated. To authenticate, open the URL with a token printed by Vitest, as shown below. Once authenticated, the direct `/__vitest__/` URL will work correctly.

```bash
vitest --ui
# UI started at http://localhost:51204/__vitest__/?token=...
```

### Fake Timers Now Mock `Temporal`

Vitest now mocks the [`Temporal`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Temporal) API alongside `Date` when fake timers are enabled, following the [`@sinonjs/fake-timers` v15.4 update](https://github.com/sinonjs/fake-timers/blob/main/CHANGELOG.md#1540--2026-05-05). This only takes effect when `Temporal` is available on the global object — either natively (Node.js >= 26 by default, behind `--harmony-temporal` on older versions, and supporting browsers) or through a globally installed polyfill such as `import 'temporal-polyfill/global'`.

Previously `Temporal.Now` kept returning the real wall-clock time even when [`vi.useFakeTimers()`](/api/vi#vi-usefaketimers) was active. Now it follows the mocked clock:

```ts
vi.useFakeTimers({ now: 0 })

Temporal.Now.instant().epochMilliseconds // 0 (was the real time in v4)
```

`Temporal` is part of the default set of faked APIs, so it is controlled by [`fakeTimers.toFake`](/config/#faketimers-tofake) and [`fakeTimers.toNotFake`](/config/#faketimers-tonotfake). To keep `Temporal` native, add it to `toNotFake`:

```ts
vi.useFakeTimers({ toNotFake: ['Temporal'] })
```

### Removed `test.sequential`, `describe.sequential`, and `sequential` Options

Vitest 5.0 removes the deprecated `test.sequential`, `describe.sequential`, and `sequential` test options. Use `concurrent: false` when you need a test or suite to opt out of inherited or globally configured concurrency.

```ts
test.sequential('example', async () => { /* ... */ }) // [!code --]
test('example', { concurrent: false }, async () => { /* ... */ }) // [!code ++]
```

```ts
describe.sequential('suite', () => { /* ... */ }) // [!code --]
describe('suite', { concurrent: false }, () => { /* ... */ }) // [!code ++]
```

The same replacement applies to option objects:

```ts
test('example', { sequential: true }, async () => { /* ... */ }) // [!code --]
test('example', { concurrent: false }, async () => { /* ... */ }) // [!code ++]
```

### Locators in Commands are Serialized as Objects

Locators forwarded to [browser commands](/api/browser/commands) are now serialized as a `SerializedLocator` object instead of a bare selector string. The object exposes two fields:

- `selector`: the provider-specific selector string (the same value commands previously received).
- `locator`: a human-readable representation of the locator (e.g. `getByRole('button')`), used for error messages and tracing.

Update any custom commands that accept a locator to destructure `selector` from the new object:

```ts
import type { SerializedLocator } from '@vitest/browser'
import type { BrowserCommandContext } from 'vitest/node'

export async function customClick(
  context: BrowserCommandContext,
  selector: string, // [!code --]
  { selector }: SerializedLocator, // [!code ++]
) {
  await context.page.locator(selector).click()
}
```

### Locators are Strict by Default

Browser locators now match the text exactly by default, requiring a full, case-sensitive match. To keep the previous behaviour, you can set [`browser.locators.exact`](/config/browser/locators#browser-locators-exact) to `false`.

```ts
// With exact: true (default), this only matches the string "Hello, World" exactly.
// With exact: false, this matches "Hello, World!", "Say Hello, World", etc.
const locator = page.getByText('Hello, World', { exact: true })
await locator.click()
```

### `toHaveTextContent` Now Performs Strict Equality

The browser-mode [`toHaveTextContent`](/api/browser/assertions#tohavetextcontent) matcher now validates that an element's text content is exactly equal to the expected string instead of performing a partial, case-sensitive match. Regular expressions are no longer accepted. The previous behaviour, including `RegExp` support, has moved to the new [`toMatchTextContent`](/api/browser/assertions#tomatchtextcontent) matcher.

```ts
// Partial or regex matches:
await expect.element(banner).toHaveTextContent('Error') // [!code --]
await expect.element(banner).toHaveTextContent(/error/i) // [!code --]
await expect.element(banner).toMatchTextContent('Error') // [!code ++]
await expect.element(banner).toMatchTextContent(/error/i) // [!code ++]

// Exact matches stay on `toHaveTextContent`:
await expect.element(banner).toHaveTextContent('Error!')
```

### Glob Coverage Thresholds No Longer Inherit `perFile`

`coverage.thresholds.perFile` previously applied to every threshold set, including files matched by glob-pattern thresholds. Glob patterns now control their own per-file checking and no longer inherit the top-level `perFile` — set `perFile` on each glob that needs it.

```ts [vitest.config.ts]
export default defineConfig({
  test: {
    coverage: {
      thresholds: {
        'perFile': true,

        'src/utils/**': {
          lines: 80,
          perFile: true, // [!code ++]
        },
      },
    },
  },
})
```

### Config Files Are Not Looked Up From Parent Directories

Vitest no longer searches parent directories for config files. If you previously relied on running `vitest` from a subdirectory while using a config file from a parent directory, pass the config explicitly and scope test discovery with `--dir`. For example,

```bash
$ cd subdir && vitest # [!code --]
$ cd subdir && vitest --config ../vitest.config.ts # [!code ++]
```

### DOM Environment Global Assignments Now Update the Underlying Window

Assignments to properties on `globalThis` or `window` in `jsdom` and `happy-dom` environments are now propagated to the underlying DOM implementation. Mutable properties such as `innerWidth` can affect APIs implemented by the DOM environment, for example `happy-dom`'s `matchMedia`.

### Browser Orchestrator URL Requires a Session

Vitest no longer serves the browser orchestrator UI from a bare `/__vitest_test__/` URL. Browser runner URLs are now session-bound and must include the `sessionId` generated by Vitest, for example `/__vitest_test__/?sessionId=...`.

If you manually opened the browser preview by copying the Vite server URL or visiting `/__vitest_test__/` directly, use the URL opened or printed by Vitest instead.

### Generated Reports and Artifacts Use the `.vitest` Directory

Vitest now uses a single `.vitest` directory at the project root as the shared artifact root, so one `.vitest` entry in `.gitignore` is enough. Defaults that moved this major:

- **Attachments** ([`attachmentsDir`](/config/attachmentsdir)): `.vitest-attachements/` → `.vitest/attachments/`
- **Blob reporter** and `--merge-reports`: `.vitest-reports/blob-*.json` → `.vitest/blob/blob-*.json`
- **HTML reporter** ([`html`](/guide/reporters#html-reporter)): `html/index.html` → `.vitest/index.html`, and its option changed from `outputFile` (a file) to `outputDir` (a directory)
- **JSON reporter** ([`json`](/guide/reporters#json-reporter)): stdout → `.vitest/json/output.json`
- **JUnit reporter** ([`junit`](/guide/reporters#junit-reporter)): stdout → `.vitest/junit/output.xml`

The `json` and `junit` reporters now write to a file by default instead of printing to stdout. If you previously relied on the report being printed to stdout (for example `vitest --reporter=json > out.json` or `vitest --reporter=json | jq`), either read the generated artifact file instead (for example `jq . .vitest/json/output.json`), or opt back into stdout with the reporter's `stdout` option (`reporters: [['json', { stdout: true }]]`). An explicit `outputFile` is still respected and unchanged.

### `toMatchScreenshot` Now Uses a Dedicated Screenshot Directory Config

Previously, reference screenshots for `toMatchScreenshot` did not correctly respect `browser.screenshotDirectory`. As a result, screenshots were saved in an unintended location when a custom directory was configured.

This has now been fixed by introducing a dedicated option: `browser.expect.toMatchScreenshot.screenshotDirectory`. Its default value is `__screenshots__`.

- If you did not set `browser.screenshotDirectory`, no changes are required.
- If you did set `browser.screenshotDirectory`, you must now explicitly configure the new option:

    ```ts [vitest.config.ts]
    export default defineConfig({
      test: {
        browser: {
          screenshotDirectory: 'my-screenshots',
          expect: { // [!code ++]
            toMatchScreenshot: { // [!code ++]
              screenshotDirectory: 'my-screenshots', // [!code ++]
            }, // [!code ++]
          }, // [!code ++]
        },
      },
    })
    ```

    Then either move existing reference screenshots to the new location or regenerate them.

### Package Migration

The following packages are deprecated as of this release. They will no longer receive feature updates, but security fixes will continue to be backported:

- [`@vitest/runner`](https://npmx.dev/package/@vitest/runner)
- [`@vitest/ws-client`](https://npmx.dev/package/@vitest/ws-client)

The [`@vitest/browser-webdriverio`](https://npmx.dev/package/@vitest/browser-webdriverio) provider has been moved to the [vitest-community](https://github.com/vitest-community/vitest-webdriverio) organization. Going forward, WebdriverIO support is community-maintained and addressed on a per-issue basis. If you use it, update your dependency to the new package and report any issues in the new repository.

### Removed Deprecated Entrypoints

Several entry points were marked as deprecated in Vitest 4.1. This release removes them entirely.

- `vitest/coverage`: use `vitest/node` instead
- `vitest/reporters`: use `vitest/node` instead
- `vitest/environments`: use `vitest/runtime` instead
- `vitest/snapshot`: use `vitest/runtime` instead
- `vitest/runners`: use `TestRunner` from `vitest` instead
- `vitest/suite`: use static methods on `TestRunner` from vitest instead (for example, `TestRunner.getCurrentTest()`)
- `vitest/mocker` is removed completely, use `@vitest/mocker` package directly (this was published by accident at one point and never removed)
- `vitest/internal/module-runner` is removed

### Deprecated APIs removed

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

### Custom Snapshot Matchers <Experimental /> <Version>4.1.3</Version> {#custom-snapshot-matcher}

Jest imports snapshot composables from `jest-snapshot`. In Vitest, use `Snapshots` from `vitest` instead:

```ts
const { toMatchSnapshot } = require('jest-snapshot') // [!code --]
import { Snapshots } from 'vitest' // [!code ++]
const { toMatchSnapshot } = Snapshots // [!code ++]

expect.extend({
  toMatchTrimmedSnapshot(received: string, length: number) {
    return toMatchSnapshot.call(this, received.slice(0, length))
  },
})
```

For inline snapshots, the same applies:

```ts
const { toMatchInlineSnapshot } = require('jest-snapshot') // [!code --]
import { Snapshots } from 'vitest' // [!code ++]
const { toMatchInlineSnapshot } = Snapshots // [!code ++]

expect.extend({
  toMatchTrimmedInlineSnapshot(received: string, inlineSnapshot?: string) {
    return toMatchInlineSnapshot.call(this, received.slice(0, 10), inlineSnapshot)
  },
})
```

See [Custom Snapshot Matchers](/guide/snapshot#custom-snapshot-matchers) for the full guide.

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
| `spy.returned(value)` | `returned` | Spy returned specific value |

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
