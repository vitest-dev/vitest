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
| `--api [port], --api.port [port]` | Specify server port. Note if the port is already being used, Vite will automatically try the next available port |
| `--api.host [host]` | Specify which IP addresses the server should listen on. Set this to 0.0.0.0 or true to listen on all addresses, including LAN and public addresses |
| `--api.strictPort` | Set to true to exit if port is already in use, instead of automatically trying the next available port |
| `--pool <pool>` | Specify pool, if not running in the browser (default: `threads`)  |
| `--poolOptions <options>` | Specify pool options |
| `--poolOptions.threads.isolate` | Isolate tests in threads pool (default: `true`)  |
| `--poolOptions.forks.isolate` | Isolate tests in forks pool (default: `true`)  |
| `--fileParallelism` | Should all test files run in parallel. Use --no-file-parallelism to disable (default: true) |
| `--maxWorkers <workers>` | Maximum number of workers to run tests in |
| `--minWorkers <workers>` | Minimum number of workers to run tests in |
| `--silent` | Silent console output from tests |
| `--reporter <name>` | Select reporter: `default`, `verbose`, `dot`, `junit`, `json`, or a path to a custom reporter |
| `--outputFile <filename/-s>` | Write test results to a file when the `--reporter=json` or `--reporter=junit` option is also specified <br /> Via [cac's dot notation](https://github.com/cacjs/cac#dot-nested-options) you can specify individual outputs for multiple reporters |
| `--coverage` | Enable coverage report |
| `--coverage.all` | Whether to include all files, including the untested ones into report (default: `true`) |
| `--coverage.provider` | Select the tool for coverage collection, available values are: "v8", "istanbul" and "custom" |
| `--coverage.enabled` | Enables coverage collection. Can be overridden using the --coverage CLI option. This option is not available for custom providers (default: false) |
| `--coverage.include` | Files included in coverage as glob patterns. May be specified more than once when using multiple patterns. This option is not available for custom providers (default: **) |
| `--coverage.extension` | Extension to be included in coverage. May be specified more than once when using multiple extensions. This option is not available for custom providers (default: `[".js", ".cjs", ".mjs", ".ts", ".mts", ".cts", ".tsx", ".jsx", ".vue", ".svelte"]`) |
| `--coverage.exclude` | Files to be excluded in coverage. May be specified more than once when using multiple extensions. This option is not available for custom providers (default: Visit https://vitest.dev/config/#coverage-exclude)
| `--coverage.clean` | Clean coverage results before running tests. This option is not available for custom providers (default: true) |
| `coverage.cleanOnRerun` | Clean coverage report on watch rerun. This option is not available for custom providers (default: true) |
| `coverage.reportsDirectory` | Directory to write coverage report to. This option is not available for custom providers (default: ./coverage) |
| `--coverage.reporter` | Coverage reporters to use. Visit [https://vitest.dev/config/#coverage-reporter](https://vitest.dev/config/#coverage-reporter) for more information. This option is not available for custom providers (default: `["text", "html", "clover", "json"]`) |
| `--coverage.reportOnFailure` | Generate coverage report even when tests fail. This option is not available for custom providers (default: `false`) |
| `--coverage.allowExternal` | Collect coverage of files outside the project root. This option is not available for custom providers (default: `false`) |
| `--coverage.skipFull` | Do not show files with 100% statement, branch, and function coverage. This option is not available for custom providers (default: `false`) |
| `--coverage.thresholds.perFile` | Check thresholds per file. See `--coverage.thresholds.lines`, `--coverage.thresholds.functions`, `--coverage.thresholds.branches` and `--coverage.thresholds.statements` for the actual thresholds. This option is not available for custom providers (default: `false`) |
| `--coverage.thresholds.autoUpdate` | Update threshold values: "lines", "functions", "branches" and "statements" to configuration file when current coverage is above the configured thresholds. This option is not available for custom providers (default: `false`) |
| `--coverage.thresholds.lines` | Threshold for lines. Visit [https://github.com/istanbuljs/nyc#coverage-thresholds](https://github.com/istanbuljs/nyc#coverage-thresholds) for more information. This option is not available for custom providers |
| `--coverage.thresholds.functions` | Threshold for functions. Visit [https://github.com/istanbuljs/nyc#coverage-thresholds](https://github.com/istanbuljs/nyc#coverage-thresholds) for more information. This option is not available for custom providers |
| `--coverage.thresholds.branches` | Threshold for branches. Visit [https://github.com/istanbuljs/nyc#coverage-thresholds](https://github.com/istanbuljs/nyc#coverage-thresholds) for more information. This option is not available for custom providers |
| `--coverage.thresholds.statements` | Threshold for statements. Visit [https://github.com/istanbuljs/nyc#coverage-thresholds](https://github.com/istanbuljs/nyc#coverage-thresholds) for more information. This option is not available for custom providers |
| `--coverage.thresholds.100` | Shortcut to set all coverage thresholds to 100. This option is only available for the v8 provider (default: `false`) |
| `--coverage.ignoreClassMethods` | Array of class method names to ignore for coverage. Visit [https://github.com/istanbuljs/nyc#ignoring-methods](https://github.com/istanbuljs/nyc#ignoring-methods) for more information. This option is only available for the istanbul providers (default: `[]`) |
| `--coverage.watermarks` | Watermarks for statements, lines, branches and functions. Visit [https://github.com/istanbuljs/nyc#high-and-low-watermarks](https://github.com/istanbuljs/nyc#high-and-low-watermarks) for more information. This option is not available for custom providers (default: Visit [https://vitest.dev/config/#coverage-watermarks](https://vitest.dev/config/#coverage-watermarks)) |
| `--coverage.customProviderModule` | Specifies the module name or path for the custom coverage provider module. Visit [https://vitest.dev/guide/coverage.html#custom-coverage-provider](https://vitest.dev/guide/coverage.html#custom-coverage-provider) for more information. This option is only available for custom providers |
| `--run` | Do not watch |
| `--isolate` | Run every test file in isolation. To disable isolation, use --no-isolate (default: `true`) |
| `--mode <name>` | Override Vite mode (default: `test`) |
| `--workspace <path>` | Path to a workspace configuration file |
| `--globals` | Inject APIs globally |
| `--dom` | Mock browser API with happy-dom |
| `--browser [options]` | Run tests in [the browser](/guide/browser) (default: `false`) |
| `--browser.enabled` | Run all tests inside a browser by default. Can be overriden with the poolMatchGlobs configuration file option (default: false) |
| `--browser.name <name>` | Run all tests in a specific browser. Some browsers are only available for specific providers (see --browser.provider). Visit https://vitest.dev/config/#browser-name for more information |
| `--browser.headless` | Run the browser in headless mode (i.e. without opening the GUI (Graphical User Interface)). If you are running Vitest in CI, it will be enabled by default (default: process.env.CI) |
| `--browser.api [port]` | Specify server port. Note if the port is already being used, Vite will automatically try the next available port so this may not be the actual port the server ends up listening on. Does not affect the --api option. If true will be set to ${defaultBrowserPort} (default: ${defaultBrowserPort}) |
| `--browser.api.port <port>` | Specify server port. Note if the port is already being used, Vite will automatically try the next available port so this may not be the actual port the server ends up listening on. Does not affect the --api.port option |
| `--browser.api.host [host]` | Specify which IP addresses the server should listen on. Set this to 0.0.0.0 or true to listen on all addresses, including LAN and public addresses. Does not affect the --api.host option |
| `--browser.provider` | Provider used to run browser tests. Some browsers are only available for specific providers. Can be "webdriverio", "playwright", or the path to a custom provider. Visit https://vitest.dev/config/#browser-provider for more information (default: "webdriverio") |
| `--browser.slowHijackESM` | Let Vitest use its own module resolution on the browser to enable APIs such as vi.mock and vi.spyOn. Visit https://vitest.dev/config/#browser-slowhijackesm for more information (default: true) |
| `--environment <env>` | Runner environment (default: `node`) |
| `--passWithNoTests` | Pass when no tests found |
| `--logHeapUsage` | Show the size of heap for each test |
| `--allowOnly` | Allow tests and suites that are marked as `only` (default: false in CI, true otherwise) |
| `--dangerouslyIgnoreUnhandledErrors` | Ignore any unhandled errors that occur |
| `--changed [since]` | Run tests that are affected by the changed files (default: false). See [docs](#changed) |
| `--shard <shard>` | Execute tests in a specified shard |
| `--sequence` | Define in what order to run tests. Use [cac's dot notation](https://github.com/cacjs/cac#dot-nested-options) to specify options (for example, use `--sequence.shuffle` to run tests in random order or `--sequence.shuffle --sequence.seed SEED_ID` to run a specific order) |
| `--sequence.concurrent [concurrent]` | Make tests run in parallel (default: false) |
| `--sequence.seed <seed>` | Set the randomization seed. This option will have no effect if --sequence.shuffle is falsy. Visit https://en.wikipedia.org/wiki/Random_seed for more information |
| `--sequence.hooks <order>` | Changes the order in which hooks are executed. Accepted values are: "stack", "list" and "parallel". Visit https://vitest.dev/config/#sequence-hooks for more information (default: "parallel") |
| `--sequence.setupFiles <order>` | Changes the order in which setup files are executed. Accepted values are: "list" and "parallel". If set to "list", will run setup files in the order they are defined. If set to "parallel", will run setup files in parallel (default: "parallel") |
| `--no-color` | Removes colors from the console output |
| `--inspect` | Enables Node.js inspector |
| `--inspect-brk` | Enables Node.js inspector with break |
| `--bail <number>` | Stop test execution when given number of tests have failed |
| `--retry <times>` | Retry the test specific number of times if it fails |
| `--exclude <glob>` | Additional file globs to be excluded from test |
| `--expand-snapshot-diff` | Show full diff when snapshot fails |
| `--disable-console-intercept` | Disable automatic interception of console logging (default: `false`) |
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

By default, Vitest only prints non-nested commands. To see all possible options, use `--expand-help` when calling `--help`:

```
vitest --help --expand-help
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
