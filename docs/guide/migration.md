# Migration Guide

## Migrating from Jest

Vitest has been designed with a Jest compatible API, in order to make the migration from Jest as simple as possible. Despite those efforts, you may still run into the following differences:

**Globals as a Default**

Jest has their [globals API](https://jestjs.io/docs/api) enabled by default. Vitest does not. You can either enable globals via [the `globals` configuration setting](/config/#globals) or update your code to use imports from the `vitest` module instead.

If you decide to keep globals disabled, be aware that common libraries like [`testing-library`](https://testing-library.com/) will not run auto DOM [cleanup](https://testing-library.com/docs/svelte-testing-library/api/#cleanup).

**Auto-Mocking Behaviour**

Unlike Jest, mocked modules in `<root>/__mocks__` are not loaded unless `vi.mock()` is called. If you need them to be mocked in every test, like in Jest, you can mock them inside [`setupFiles`](/config/#setupfiles).

**Mocking globals**

In Jest, you could mock global variables by putting them on `window` object. Vitest treats `globalThis` and `window` as different objects, so you would need to either put it on both `window` and `globalThis`, or use [`vi.stubGlobal`](/api/#vi-stubglobal) helper.

**Jasmine API**

Jest exports various [`jasmine`](https://jasmine.github.io/) globals (such as `jasmine.any()`). Any such instances will need to be migrated to [their Vitest counterparts](/api/).

**Envs**

Just like Jest, Vitest sets `NODE_ENV` to `test`, if it wasn't set before. Vitest also has a counterpart for `JEST_WORKER_ID` called `VITEST_WORKER_ID`, so if you rely on it, don't forget to rename it.

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

**Vue Snapshots**

This is not a Jest specific feature, but if you previously were using Jest with vue-cli preset, you will need to install [`jest-serializer-vue`](https://github.com/eddyerburgh/jest-serializer-vue) package, and use it inside [setupFiles](/config/#setupfiles):

```ts
import vueSnapshotSerializer from 'jest-serializer-vue'

// Add Snapshot Serializer
expect.addSnapshotSerializer(vueSnapshotSerializer)
```

Otherwise your snapshots will have a lot of escaped `"` characters.
