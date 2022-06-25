# Migration Guide

## Migrating from Jest

Vitest has been designed with a Jest compatible API, in order to make the migration from Jest as simple as possible. Despite those efforts, you may still run into the following differences:

**Globals as a Default**

Jest has their [globals API](https://jestjs.io/docs/api) enabled by default. Vitest does not. You can either enable globals via [the `globals` configuration setting](/config/#globals) or update your code to use imports from the `vitest` module instead.

If you decide to keep globals disabled, be aware that common libraries like [`testing-library`](https://testing-library.com/) will not run auto DOM [cleanup](https://testing-library.com/docs/svelte-testing-library/api/#cleanup).

**Auto-Mocking Behaviour**

Unlike Jest, mocked modules in `<root>/__mocks__` are not loaded unless `vi.mock()` is called. If you need them to be mocked in every test, like in Jest, you can mock them inside [`setupFiles`](/config/#setupfiles).

**Jasmine API**

Jest exports various [`jasmine`](https://jasmine.github.io/) globals (such as `jasmine.any()`). Any such instances will need to be migrated to [their Vitest counterparts](/api/).

**Envs**

Just like Jest, Vitest sets `NODE_ENV` to `test`, if it wasn't set before. Vitest also has a counterpart for `JEST_WORKER_ID` called `VITEST_POOL_ID` (always less than or equal to `maxThreads`), so if you rely on it, don't forget to rename it. Vitest also exposes `VITEST_WORKER_ID` which is a unique ID of a running worker - this number is not affected by `maxThreads`, and will increase with each created worker.

**Done Callback**

From Vitest v0.10.0, the callback style of declaring tests is deprecated. You can rewrite them to use `async`/`await` functions, or use Promise to mimic the callback style.

```diff
- it('should work', (done) => {
+ it('should work', () => new Promise(done => {
    // ...
    done()
- })
+ }))
```

**Hooks**

`beforeAll`/`beforeEach` hooks may return [teardown function](/api/#setup-and-teardown) in Vitest. Because of that you may need to rewrite your hooks declarations, if they return something other than `undefined` or `null`:

```diff
- beforeEach(() => setActivePinia(createTestingPinia()))
+ beforeEach(() => { setActivePinia(createTestingPinia()) })
```

**Types**

Vitest doesn't expose a lot of types on `Vi` namespace, it exists mainly for compatibility with matchers, so you might need to import types directly from `vitest` instead of relying on `Vi` namespace:

```diff
- let fn: jest.Mock<string, [string]>
+ import type { Mock } from 'vitest'
+ let fn: Mock<[string], string>
```

Also, Vitest has `Args` type as a first argument instead of `Returns`, as you can see in diff.

**Timers**

Vitest doesn't support jest's legacy timers.

**it.each**

Vitest intentionally doesn't support template literals for `it.each`. You will need to rewrite it to either an array of arguments, or array of objects:

Before:
```ts
it.each`
a    | b    | expected
${1} | ${3} | ${4}
${2} | ${2} | ${4}
`('adds $a to $b', ({ a, b, expected }) => {
  expect(add(a, b)).toEqual(expected)
})
```

After:
```ts
it.each([
  [1, 3, 4],
  [2, 2, 4],
])('adds %d to %d', (a, b, expected) => {
  expect(add(a, b)).toEqual(expected)
})
```

**Vue Snapshots**

This is not a Jest specific feature, but if you previously were using Jest with vue-cli preset, you will need to install [`jest-serializer-vue`](https://github.com/eddyerburgh/jest-serializer-vue) package, and use it inside [setupFiles](/config/#setupfiles):

```ts
import vueSnapshotSerializer from 'jest-serializer-vue'

// Add Snapshot Serializer
expect.addSnapshotSerializer(vueSnapshotSerializer)
```

Otherwise your snapshots will have a lot of escaped `"` characters.
