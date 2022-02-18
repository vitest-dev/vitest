# Migration Guide

<DevelopmentWarning/>

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

Just like Jest, Vitest sets `NODE_ENV` to `test`, if it wasn't set before. Vitest also has a counterpart for `JEST_WORKER_ID` called `VITEST_WORKER_ID`, so if you rely on it, don't forget to rename it.