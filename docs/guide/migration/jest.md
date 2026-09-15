---
title: Migrating from Jest | Guide
outline: deep
---

# Migrating from Jest {#jest}

Vitest has been designed with a Jest compatible API, in order to make the migration from Jest as simple as possible. Despite those efforts, you may still run into the following differences:

## Globals as a Default

Jest has their [globals API](https://jestjs.io/docs/api) enabled by default. Vitest does not. You can either enable globals via [the `globals` configuration setting](/config/globals) or update your code to use imports from the `vitest` module instead.

If you decide to keep globals disabled, be aware that common libraries like [`testing-library`](https://testing-library.com/) will not run auto DOM [cleanup](https://testing-library.com/docs/svelte-testing-library/api/#cleanup).

## `mock.mockReset`

Jest's [`mockReset`](https://jestjs.io/docs/mock-function-api#mockfnmockreset) replaces the mock implementation with an
empty function that returns `undefined`.

Vitest's [`mockReset`](/api/mock#mockreset) resets the mock implementation to its original.
That is, resetting a mock created by `vi.fn(impl)` will reset the mock implementation to `impl`.

## `mock.mock` is Persistent

Jest will recreate the mock state when `.mockClear` is called, meaning you always need to access it as a getter. Vitest, on the other hand, holds a persistent reference to the state, meaning you can reuse it:

```ts
const mock = vi.fn()
const state = mock.mock
mock.mockClear()

expect(state).toBe(mock.mock) // fails in Jest
```

## Module Mocks

When mocking a module in Jest, the factory argument's return value is the default export. In Vitest, the factory argument has to return an object with each export explicitly defined. For example, the following `jest.mock` would have to be updated as follows:

```ts
jest.mock('./some-path', () => 'hello') // [!code --]
vi.mock('./some-path', () => ({ // [!code ++]
  default: 'hello', // [!code ++]
})) // [!code ++]
```

For more details please refer to the [`vi.mock` api section](/api/vi#vi-mock).

## Auto-Mocking Behaviour

Unlike Jest, mocked modules in `<root>/__mocks__` are not loaded unless `vi.mock()` is called. If you need them to be mocked in every test, like in Jest, you can mock them inside [`setupFiles`](/config/setupfiles).

## Importing the Original of a Mocked Package

If you are only partially mocking a package, you might have previously used Jest's function `requireActual`. In Vitest, you should replace these calls with `vi.importActual`.

```ts
const { cloneDeep } = jest.requireActual('lodash/cloneDeep') // [!code --]
const { cloneDeep } = await vi.importActual('lodash/cloneDeep') // [!code ++]
```

## Extends mocking to external libraries

Where Jest does it by default, when mocking a module and wanting this mocking to be extended to other external libraries that use the same module, you should explicitly tell which 3rd-party library you want to be mocked, so the external library would be part of your source code, by using [server.deps.inline](/config/server#inline).

```
server.deps.inline: ["lib-name"]
```

## expect.getState().currentTestName

Vitest's `test` names are joined with a `>` symbol to make it easier to distinguish tests from suites, while Jest uses an empty space (` `).

```diff
- `${describeTitle} ${testTitle}`
+ `${describeTitle} > ${testTitle}`
```

The same applies to [`testNamePattern`](/config/testnamepattern) (the `-t` flag): Vitest matches against the `>`-joined full name, while Jest matches the space-joined name. Update patterns that span a suite and a test accordingly, or match a single segment (`-t adds`) or use a wildcard between segments (`-t 'math.*adds'`).

```diff
- vitest -t 'math adds'
+ vitest -t 'math > adds'
```

## Envs

Just like Jest, Vitest sets `NODE_ENV` to `test`, if it wasn't set before. Vitest also has a counterpart for `JEST_WORKER_ID` called `VITEST_POOL_ID` (always less than or equal to `maxWorkers`), so if you rely on it, don't forget to rename it. Vitest also exposes `VITEST_WORKER_ID` which is a unique ID of a running worker - this number is not affected by `maxWorkers`, and will increase with each created worker.

## Replace property

If you want to modify the object, you will use [replaceProperty API](https://jestjs.io/docs/jest-object#jestreplacepropertyobject-propertykey-value) in Jest, you can use [`vi.stubEnv`](/api/vi#vi-stubenv) or [`vi.spyOn`](/api/vi#vi-spyon) to do the same also in Vitest.

## Done Callback

Vitest does not support the callback style of declaring tests. You can rewrite them to use `async`/`await` functions, or use Promise to mimic the callback style.

<!--@include: ../examples/promise-done.md-->

## Hooks

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

## Types

Vitest doesn't have an equivalent to `jest` namespace, so you will need to import types directly from `vitest`:

```ts
let fn: jest.Mock<(name: string) => number> // [!code --]
import type { Mock } from 'vitest' // [!code ++]
let fn: Mock<(name: string) => number> // [!code ++]
```

## Timers

Vitest doesn't support Jest's legacy timers.

## Timeout

If you used `jest.setTimeout`, you would need to migrate to `vi.setConfig`:

```ts
jest.setTimeout(5_000) // [!code --]
vi.setConfig({ testTimeout: 5_000 }) // [!code ++]
```

## Vue Snapshots

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

## Custom Snapshot Matchers <Experimental /> <Version>4.1.3</Version> {#custom-snapshot-matcher}

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
