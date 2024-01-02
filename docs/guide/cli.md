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

| Options       |               |
| ------------- | ------------- |
| `-v, --version` | Display version number |
| `-r, --root <path>` | Define the project root |
| `-c, --config <path>` | Path to config file |
| `-u, --update` | Update snapshots |
| `-w, --watch` | Smart & instant watch mode |
| `-t, --testNamePattern <pattern>` | Run tests with full names matching the pattern |
| `--dir <path>`| Base directory to scan for the test files |
| `--ui` | Enable UI |
| `--open` | Open the UI automatically if enabled (default: `true`) |
| `--api [api]` | Serve API, available options: `--api.port <port>`, `--api.host [host]` and `--api.strictPort` |
| `--pool <pool>` | Specify pool, if not running in the browser (default: `threads`)  |
| `--poolOptions <options>` | Specify pool options |
| `--poolOptions.threads.isolate` | Isolate tests in threads pool (default: `true`)  |
| `--poolOptions.forks.isolate` | Isolate tests in forks pool (default: `true`)  |
| `--fileParallelism` | Should all test files run in parallel. Use --no-file-parallelism to disable (default: true) |
| `--maxWorkers` | Maximum number of workers to run tests in |
| `--minWorkers` | Minimum number of workers to run tests in |
| `--silent` | Silent console output from tests |
| `--reporter <name>` | Select reporter: `default`, `verbose`, `dot`, `junit`, `json`, or a path to a custom reporter |
| `--outputFile <filename/-s>` | Write test results to a file when the `--reporter=json` or `--reporter=junit` option is also specified <br /> Via [cac's dot notation] you can specify individual outputs for multiple reporters |
| `--coverage` | Enable coverage report |
| `--run` | Do not watch |
| `--isolate` | Run every test file in isolation. To disable isolation, use --no-isolate (default: `true`) |
| `--mode <name>` | Override Vite mode (default: `test`) |
| `--workspace <path>` | Path to a workspace configuration file |
| `--globals` | Inject APIs globally |
| `--dom` | Mock browser API with happy-dom |
| `--browser [options]` | Run tests in [the browser](/guide/browser) (default: `false`) |
| `--environment <env>` | Runner environment (default: `node`) |
| `--passWithNoTests` | Pass when no tests found |
| `--logHeapUsage` | Show the size of heap for each test |
| `--allowOnly` | Allow tests and suites that are marked as `only` (default: false in CI, true otherwise) |
| `--dangerouslyIgnoreUnhandledErrors` | Ignore any unhandled errors that occur |
| `--changed [since]` | Run tests that are affected by the changed files (default: false). See [docs](#changed) |
| `--shard <shard>` | Execute tests in a specified shard |
| `--sequence` | Define in what order to run tests. Use [cac's dot notation] to specify options (for example, use `--sequence.shuffle` to run tests in random order or `--sequence.shuffle --sequence.seed SEED_ID` to run a specific order) |
| `--no-color` | Removes colors from the console output |
| `--inspect` | Enables Node.js inspector |
| `--inspect-brk` | Enables Node.js inspector with break |
| `--bail <number>` | Stop test execution when given number of tests have failed |
| `--retry <times>` | Retry the test specific number of times if it fails |
| `--exclude <glob>` | Additional file globs to be excluded from test |
| `--expand-snapshot-diff` | Show full diff when snapshot fails |
| `--typecheck [options]` | Custom options for typecheck pool. If passed without options, enables typechecking |
| `--typecheck.enabled` | Enable typechecking alongside tests (default: `false`) |
| `--typecheck.only` | Run only typecheck tests. This automatically enables typecheck (default: `false`) |
| `--project` | The name of the project to run if you are using Vitest workspace feature. This can be repeated for multiple projects: `--project=1 --project=2` |
| `-h, --help` | Display available CLI options |

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

  To run tests against changes made in the last commit, you can use `--changed HEAD~1`. You can also pass commit hash or branch name.

  If paired with the `forceRerunTriggers` config option it will run the whole test suite if a match is found.

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
