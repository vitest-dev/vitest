---
title: Command Line Interface | Guide
---

# Command Line Interface

## Commands

### `vitest`

Start Vitest in the current directory. Will enter the watch mode in development environment and run mode in CI automatically.

You can pass a addition argument as the filter of the tests files to run. For example:

```bash
vitest foobar
```

Will run only the test file that contains `foobar` in their paths.

### `vitest run`

Perform a single run without watch mode.

### `vitest watch`

Run all test suites but watch for changes and rerun tests when they change. Same as calling `vitest` without a command. Will fallback to `vitest run` in CI.

### `vitest dev`

Alias to `vitest watch`.

### `vitest related`

Run only tests that cover a list of source files. Works with static imports (e.g., `import('./index.ts')` or `import index from './index.ts`), but not the dynamic ones (e.g., `import(filepath)`). All files should be relative to root folder.

Useful to run with [`lint-staged`](https://github.com/okonet/lint-staged) or with your CI setup.

```bash
vitest related /src/index.ts /src/hello-world.js
```

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
| `--threads` | Enable Threads (default: `true`) |
| `--silent` | Silent console output from tests |
| `--isolate` | Isolate environment for each test file (default: `true`) |
| `--reporter <name>` | Select reporter: `default`, `verbose`, `dot`, `junit`, `json`, or a path to a custom reporter |
| `--outputTruncateLength <length>` | Truncate output diff lines up to `<length>` number of characters. |
| `--outputDiffLines <lines>` | Limit number of output diff lines up to `<lines>`. |
| `--outputFile <filename/-s>` | Write test results to a file when the `--reporter=json` or `--reporter=junit` option is also specified <br /> Via [cac's dot notation] you can specify individual outputs for multiple reporters |
| `--coverage` | Use c8 for coverage |
| `--run` | Do not watch |
| `--mode` | Override Vite mode (default: `test`) |
| `--mode <name>` | Override Vite mode (default: `test`) |
| `--globals` | Inject APIs globally |
| `--dom` | Mock browser api with happy-dom |
| `--browser` | Run tests in browser |
| `--environment <env>` | Runner environment (default: `node`) |
| `--passWithNoTests` | Pass when no tests found |
| `--allowOnly` | Allow tests and suites that are marked as `only` (default: false in CI, true otherwise) |
| `--dangerouslyIgnoreUnhandledErrors` | Ignore any unhandled errors that occur |
| `--changed [since]` | Run tests that are affected by the changed files (default: false). See [docs](#changed) |
| `--shard <shard>` | Execute tests in a specified shard |
| `--sequence` | Define in what order to run tests. Use [cac's dot notation] to specify options (for example, use `--sequence.shuffle` to run tests in random order) |
| `--no-color` | Removes colors from the console output |
| `-h, --help` | Display available CLI options |

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
