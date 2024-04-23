| Options       |               |
| ------------- | ------------- |
| `-r, --root <path>` | Root path |
| `-c, --config <path>` | Path to config file |
| `-u, --update` | Update snapshot |
| `-w, --watch` | Enable watch mode |
| `-t, --testNamePattern <pattern>` | Run tests with full names matching the specified regexp pattern |
| `--dir <path>` | Base directory to scan for the test files |
| `--ui` | Enable UI |
| `--open` | Open UI automatically (default: `!process.env.CI`) |
| `--port [port]` | Specify server port. Note if the port is already being used, Vite will automatically try the next available port so this may not be the actual port the server ends up listening on. If true will be set to `51204` |
| `--host [host]` | Specify which IP addresses the server should listen on. Set this to `0.0.0.0` or `true` to listen on all addresses, including LAN and public addresses |
| `--strictPort` | Set to true to exit if port is already in use, instead of automatically trying the next available port |
| `--silent` | Silent console output from tests |
| `--hideSkippedTests` | Hide logs for skipped tests |
| `--reporter <name>` | Specify reporters |
| `--outputFile <filename/-s>` | Write test results to a file when supporter reporter is also specified, use cac's dot notation for individual outputs of multiple reporters (example: --outputFile.tap=./tap.txt) |
| `--all` | Whether to include all files, including the untested ones into report |
| `--provider <name>` | Select the tool for coverage collection, available values are: "v8", "istanbul" and "custom" |
| `--enabled` | Enables coverage collection. Can be overridden using the `--coverage` CLI option (default: `false`) |
| `--include <pattern>` | Files included in coverage as glob patterns. May be specified more than once when using multiple patterns (default: `**`) |
| `--exclude <pattern>` | Files to be excluded in coverage. May be specified more than once when using multiple extensions (default: Visit [`coverage.exclude`](https://vitest.dev/config/#coverage-exclude)) |
| `--extension <extension>` | Extension to be included in coverage. May be specified more than once when using multiple extensions (default: `[".js", ".cjs", ".mjs", ".ts", ".mts", ".cts", ".tsx", ".jsx", ".vue", ".svelte"]`) |
| `--clean` | Clean coverage results before running tests (default: true) |
| `--cleanOnRerun` | Clean coverage report on watch rerun (default: true) |
| `--reportsDirectory <path>` | Directory to write coverage report to (default: ./coverage) |
| `--reporter <name>` | Coverage reporters to use. Visit [`coverage.reporter`](https://vitest.dev/config/#coverage-reporter) for more information (default: `["text", "html", "clover", "json"]`) |
| `--reportOnFailure` | Generate coverage report even when tests fail (default: false) |
| `--allowExternal` | Collect coverage of files outside the project root (default: false) |
| `--skipFull` | Do not show files with 100% statement, branch, and function coverage (default: false) |
| `--100` | Shortcut to set all coverage thresholds to 100 (default: `false`) |
| `--perFile` | Check thresholds per file. See `--coverage.thresholds.lines`, `--coverage.thresholds.functions`, `--coverage.thresholds.branches` and `--coverage.thresholds.statements` for the actual thresholds (default: `false`) |
| `--autoUpdate` | Update threshold values: "lines", "functions", "branches" and "statements" to configuration file when current coverage is above the configured thresholds (default: `false`) |
| `--lines <number>` | Threshold for lines. Visit [istanbuljs](https://github.com/istanbuljs/nyc#coverage-thresholds) for more information. This option is not available for custom providers |
| `--functions <number>` | Threshold for functions. Visit [istanbuljs](https://github.com/istanbuljs/nyc#coverage-thresholds) for more information. This option is not available for custom providers |
| `--branches <number>` | Threshold for branches. Visit [istanbuljs](https://github.com/istanbuljs/nyc#coverage-thresholds) for more information. This option is not available for custom providers |
| `--statements <number>` | Threshold for statements. Visit [istanbuljs](https://github.com/istanbuljs/nyc#coverage-thresholds) for more information. This option is not available for custom providers |
| `--ignoreClassMethods <name>` | Array of class method names to ignore for coverage. Visit [istanbuljs](https://github.com/istanbuljs/nyc#ignoring-methods) for more information. This option is only available for the istanbul providers (default: `[]`) |
| `--processingConcurrency <number>` | Concurrency limit used when processing the coverage results. (default min between 20 and the number of CPUs) |
| `--customProviderModule <path>` | Specifies the module name or path for the custom coverage provider module. Visit [Custom Coverage Provider](https://vitest.dev/guide/coverage#custom-coverage-provider) for more information. This option is only available for custom providers |
| `--statements <watermarks>` | High and low watermarks for statements in the format of `<high>,<low>` |
| `--lines <watermarks>` | High and low watermarks for lines in the format of `<high>,<low>` |
| `--branches <watermarks>` | High and low watermarks for branches in the format of `<high>,<low>` |
| `--functions <watermarks>` | High and low watermarks for functions in the format of `<high>,<low>` |
| `--mode <name>` | Override Vite mode (default: `test` or `benchmark`) |
| `--workspace <path>` | Path to a workspace configuration file |
| `--isolate` | Run every test file in isolation. To disable isolation, use `--no-isolate` (default: `true`) |
| `--globals` | Inject apis globally |
| `--dom` | Mock browser API with happy-dom |
| `--enabled` | Run tests in the browser. Equivalent to `--browser.enabled` (default: `false`) |
| `--name <name>` | Run all tests in a specific browser. Some browsers are only available for specific providers (see `--browser.provider`). Visit [`browser.name`](https://vitest.dev/config/#browser-name) for more information |
| `--headless` | Run the browser in headless mode (i.e. without opening the GUI (Graphical User Interface)). If you are running Vitest in CI, it will be enabled by default (default: `process.env.CI`) |
| `--port [port]` | Specify server port. Note if the port is already being used, Vite will automatically try the next available port so this may not be the actual port the server ends up listening on. If true will be set to `63315` |
| `--host [host]` | Specify which IP addresses the server should listen on. Set this to `0.0.0.0` or `true` to listen on all addresses, including LAN and public addresses |
| `--strictPort` | Set to true to exit if port is already in use, instead of automatically trying the next available port |
| `--provider <name>` | Provider used to run browser tests. Some browsers are only available for specific providers. Can be "webdriverio", "playwright", or the path to a custom provider. Visit [`browser.provider`](https://vitest.dev/config/#browser-provider) for more information (default: `"webdriverio"`) |
| `--providerOptions <options>` | Options that are passed down to a browser provider. Visit [`browser.providerOptions`](https://vitest.dev/config/#browser-provideroptions) for more information |
| `--slowHijackESM` | Let Vitest use its own module resolution on the browser to enable APIs such as vi.mock and vi.spyOn. Visit [`browser.slowHijackESM`](https://vitest.dev/config/#browser-slowhijackesm) for more information (default: `false`) |
| `--isolate` | Run every browser test file in isolation. To disable isolation, use `--browser.isolate=false` (default: `true`) |
| `--fileParallelism` | Should all test files run in parallel. Use `--browser.file-parallelism=false` to disable (default: same as `--file-parallelism`) |
| `--pool <pool>` | Specify pool, if not running in the browser (default: `threads`) |
| `--isolate` | Isolate tests in threads pool (default: `true`) |
| `--singleThread` | Run tests inside a single thread (default: `false`) |
| `--maxThreads <workers>` | Maximum number of threads to run tests in |
| `--minThreads <workers>` | Minimum number of threads to run tests in |
| `--useAtomics` | Use Atomics to synchronize threads. This can improve performance in some cases, but might cause segfault in older Node versions (default: `false`) |
| `--isolate` | Isolate tests in threads pool (default: `true`) |
| `--singleThread` | Run tests inside a single thread (default: `false`) |
| `--maxThreads <workers>` | Maximum number of threads to run tests in |
| `--minThreads <workers>` | Minimum number of threads to run tests in |
| `--useAtomics` | Use Atomics to synchronize threads. This can improve performance in some cases, but might cause segfault in older Node versions (default: `false`) |
| `--memoryLimit <limit>` | Memory limit for VM threads pool. If you see memory leaks, try to tinker this value. |
| `--isolate` | Isolate tests in threads pool (default: `true`) |
| `--singleFork` | Run tests inside a single child_process (default: `false`) |
| `--maxForks <workers>` | Maximum number of processes to run tests in |
| `--minForks <workers>` | Minimum number of processes to run tests in |
| `--isolate` | Isolate tests in threads pool (default: `true`) |
| `--singleFork` | Run tests inside a single child_process (default: `false`) |
| `--maxForks <workers>` | Maximum number of processes to run tests in |
| `--minForks <workers>` | Minimum number of processes to run tests in |
| `--memoryLimit <limit>` | Memory limit for VM forks pool. If you see memory leaks, try to tinker this value. |
| `--fileParallelism` | Should all test files run in parallel. Use `--no-file-parallelism` to disable (default: `true`) |
| `--maxWorkers <workers>` | Maximum number of workers to run tests in |
| `--minWorkers <workers>` | Minimum number of workers to run tests in |
| `--environment <name>` | Specify runner environment, if not running in the browser (default: `node`) |
| `--passWithNoTests` | Pass when no tests are found |
| `--logHeapUsage` | Show the size of heap for each test when running in node |
| `--allowOnly` | Allow tests and suites that are marked as only (default: `!process.env.CI`) |
| `--dangerouslyIgnoreUnhandledErrors` | Ignore any unhandled errors that occur |
| `--shard <shards>` | Test suite shard to execute in a format of `<index>/<count>` |
| `--changed [since]` | Run tests that are affected by the changed files (default: `false`) |
| `--files` | Run files in a random order. Long running tests will not start earlier if you enable this option. (default: `false`) |
| `--tests` | Run tests in a random oder (default: `false`) |
| `--concurrent` | Make tests run in parallel (default: `false`) |
| `--seed <seed>` | Set the randomization seed. This option will have no effect if --sequence.shuffle is falsy. Visit ["Random Seed" page](https://en.wikipedia.org/wiki/Random_seed) for more information |
| `--hooks <order>` | Changes the order in which hooks are executed. Accepted values are: "stack", "list" and "parallel". Visit [`sequence.hooks`](https://vitest.dev/config/#sequence-hooks) for more information (default: `"parallel"`) |
| `--setupFiles <order>` | Changes the order in which setup files are executed. Accepted values are: "list" and "parallel". If set to "list", will run setup files in the order they are defined. If set to "parallel", will run setup files in parallel (default: `"parallel"`) |
| `--inspect [[host:]port]` | Enable Node.js inspector (default: `127.0.0.1:9229`) |
| `--inspectBrk [[host:]port]` | Enable Node.js inspector and break before the test starts |
| `--testTimeout <timeout>` | Default timeout of a test in milliseconds (default: `5000`) |
| `--hookTimeout <timeout>` | Default hook timeout in milliseconds (default: `10000`) |
| `--bail <number>` | Stop test execution when given number of tests have failed (default: `0`) |
| `--retry <times>` | Retry the test specific number of times if it fails (default: `0`) |
| `--diff <path>` | Path to a diff config that will be used to generate diff interface |
| `--exclude <glob>` | Additional file globs to be excluded from test |
| `--expandSnapshotDiff` | Show full diff when snapshot fails |
| `--disableConsoleIntercept` | Disable automatic interception of console logging (default: `false`) |
| `--enabled` | Enable typechecking alongside tests (default: `false`) |
| `--only` | Run only typecheck tests. This automatically enables typecheck (default: `false`) |
| `--checker <name>` | Specify the typechecker to use. Available values are: "tcs" and "vue-tsc" and a path to an executable (default: `"tsc"`) |
| `--allowJs` | Allow JavaScript files to be typechecked. By default takes the value from tsconfig.json |
| `--ignoreSourceErrors` | Ignore type errors from source files |
| `--tsconfig <path>` | Path to a custom tsconfig file |
| `--project <name>` | The name of the project to run if you are using Vitest workspace feature. This can be repeated for multiple projects: `--project=1 --project=2`. You can also filter projects using wildcards like `--project=packages*` |
| `--slowTestThreshold <threshold>` | Threshold in milliseconds for a test to be considered slow (default: `300`) |
| `--teardownTimeout <timeout>` | Default timeout of a teardown function in milliseconds (default: `10000`) |
| `--maxConcurrency <number>` | Maximum number of concurrent tests in a suite (default: `5`) |
| `--run` | Disable watch mode |
| `--segfaultRetry <times>` | Retry the test suite if it crashes due to a segfault (default: `true`) |
| `--no-color` | Removes colors from the console output |
| `--clearScreen` | Clear terminal screen when re-running tests during watch mode (default: `true`) |
