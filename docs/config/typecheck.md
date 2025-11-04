---
title: typecheck | Config
outline: deep
---

# typecheck <Experimental /> {#typecheck}

Options for configuring [typechecking](/guide/testing-types) test environment.

## typecheck.enabled {#typecheck-enabled}

- **Type**: `boolean`
- **Default**: `false`
- **CLI**: `--typecheck`, `--typecheck.enabled`

Enable typechecking alongside your regular tests.

## typecheck.only {#typecheck-only}

- **Type**: `boolean`
- **Default**: `false`
- **CLI**: `--typecheck.only`

Run only typecheck tests, when typechecking is enabled. When using CLI, this option will automatically enable typechecking.

## typecheck.checker

- **Type**: `'tsc' | 'vue-tsc' | string`
- **Default**: `tsc`

What tools to use for type checking. Vitest will spawn a process with certain parameters for easier parsing, depending on the type. Checker should implement the same output format as `tsc`.

You need to have a package installed to use typechecker:

- `tsc` requires `typescript` package
- `vue-tsc` requires `vue-tsc` package

You can also pass down a path to custom binary or command name that produces the same output as `tsc --noEmit --pretty false`.

## typecheck.include

- **Type**: `string[]`
- **Default**: `['**/*.{test,spec}-d.?(c|m)[jt]s?(x)']`

Glob pattern for files that should be treated as test files

## typecheck.exclude

- **Type**: `string[]`
- **Default**: `['**/node_modules/**', '**/dist/**', '**/cypress/**', '**/.{idea,git,cache,output,temp}/**']`

Glob pattern for files that should not be treated as test files

## typecheck.allowJs

- **Type**: `boolean`
- **Default**: `false`

Check JS files that have `@ts-check` comment. If you have it enabled in tsconfig, this will not overwrite it.

## typecheck.ignoreSourceErrors

- **Type**: `boolean`
- **Default**: `false`

Do not fail, if Vitest found errors outside the test files. This will not show you non-test errors at all.

By default, if Vitest finds source error, it will fail test suite.

## typecheck.tsconfig

- **Type**: `string`
- **Default**: _tries to find closest tsconfig.json_

Path to custom tsconfig, relative to the project root.

## typecheck.spawnTimeout

- **Type**: `number`
- **Default**: `10_000`

Minimum time in milliseconds it takes to spawn the typechecker.
