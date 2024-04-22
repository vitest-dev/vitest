---
title: Command Line Interface | Guide
---

# Command Line Interface

## Commands

### `vitest`

Start Vitest in the current directory. Will enter the watch mode in development environment and run mode in CI automatically.

You can pass an additional argument as the filter of the test files to run. For example:

```bash
vitest foobar
```

Will run only the test file that contains `foobar` in their paths. This filter only checks inclusion and doesn't support regexp or glob patterns (unless your terminal processes it before Vitest receives the filter).

### `vitest run`

Perform a single run without watch mode.

### `vitest watch`

Run all test suites but watch for changes and rerun tests when they change. Same as calling `vitest` without an argument. Will fallback to `vitest run` in CI.

### `vitest dev`

Alias to `vitest watch`.

### `vitest related`

Run only tests that cover a list of source files. Works with static imports (e.g., `import('./index.js')` or `import index from './index.js`), but not the dynamic ones (e.g., `import(filepath)`). All files should be relative to root folder.

Useful to run with [`lint-staged`](https://github.com/okonet/lint-staged) or with your CI setup.

```bash
vitest related /src/index.ts /src/hello-world.js
```

::: tip
Don't forget that Vitest runs with enabled watch mode by default. If you are using tools like `lint-staged`, you  should also pass `--run` option, so that command can exit normally.

```js
// .lintstagedrc.js
export default {
  '*.{js,ts}': 'vitest related --run',
}
```
:::

### `vitest bench`

Run only [benchmark](https://vitest.dev/guide/features.html#benchmarking-experimental) tests, which compare performance results.

## Options

<!--@include: ./cli-table.md-->

::: tip
Vitest supports both camel case and kebab case for CLI arguments. For example, `--passWithNoTests` and `--pass-with-no-tests` will both work (`--no-color` and `--inspect-brk` are the exceptions).

Vitest also supports different ways of specifying the value: `--reporter dot` and `--reporter=dot` are both valid.

If option supports an array of values, you need to pass the option multiple times:

```
vitest --reporter=dot --reporter=default
```

Boolean options can be negated with `no-` prefix. Specifying the value as `false` also works:

```
vitest --no-api
vitest --api=false
```
:::

### changed

- **Type**: `boolean | string`
- **Default**: false

  Run tests only against changed files. If no value is provided, it will run tests against uncommitted changes (including staged and unstaged).

  To run tests against changes made in the last commit, you can use `--changed HEAD~1`. You can also pass commit hash (e.g. `--changed 09a9920`) or branch name (e.g. `--changed origin/develop`).

  When used with code coverage the report will contain only the files that were related to the changes.

  If paired with the [`forceRerunTriggers`](/config/#forcereruntriggers) config option it will run the whole test suite if at least one of the files listed in the `forceRerunTriggers` list changes. By default, changes to the Vitest config file and `package.json` will always rerun the whole suite.

### shard

- **Type**: `string`
- **Default**: disabled

  Test suite shard to execute in a format of `<index>`/`<count>`, where

  - `count` is a positive integer, count of divided parts
  - `index` is a positive integer, index of divided part

  This command will divide all tests into `count` equal parts, and will run only those that happen to be in an `index` part. For example, to split your tests suite into three parts, use this:

  ```sh
  vitest run --shard=1/3
  vitest run --shard=2/3
  vitest run --shard=3/3
  ```

:::warning
You cannot use this option with `--watch` enabled (enabled in dev by default).
:::

[cac's dot notation]: https://github.com/cacjs/cac#dot-nested-options
