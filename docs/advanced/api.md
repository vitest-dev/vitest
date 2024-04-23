# Node API

::: warning
Vitest exposes experimental private API. Breaking changes might not follow SemVer, please pin Vitest's version when using it.
:::

## startVitest

You can start running Vitest tests using its Node API:

```js twoslash
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

## createVitest

You can create Vitest instance yourself using `createVitest` function. It returns the same `Vitest` instance as `startVitest`, but it doesn't start tests and doesn't validate installed packages.

```js twoslash
import { createVitest } from 'vitest/node'

const vitest = await createVitest('test', {
  watch: false,
})
```

## parseCLI

You can use this method to parse CLI arguments. It accepts a string (where arguments are split by a single space) or a strings array of CLI arguments in the same format that Vitest CLI uses. It returns a filter and `options` that you can later pass down to `createVitest` or `startVitest` methods.

```ts twoslash
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
