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
| `--api.port [port]` | Specify server port. Note if the port is already being used, Vite will automatically try the next available port so this may not be the actual port the server ends up listening on. If true will be set to `51204` |
| `--api.host [host]` | Specify which IP addresses the server should listen on. Set this to `0.0.0.0` or `true` to listen on all addresses, including LAN and public addresses |
| `--api.strictPort` | Set to true to exit if port is already in use, instead of automatically trying the next available port |
| `--silent` | Silent console output from tests |
| `--hideSkippedTests` | Hide logs for skipped tests |
| `--reporter <name>` | Specify reporters |
| `--outputFile <filename/-s>` | Write test results to a file when supporter reporter is also specified, use cac's dot notation for individual outputs of multiple reporters (example: --outputFile.tap=./tap.txt) |
| `--coverage.all` | Whether to include all files, including the untested ones into report |
| `--coverage.provider <name>` | Select the tool for coverage collection, available values are: "v8", "istanbul" and "custom" |
| `--coverage.enabled` | Enables coverage collection. Can be overridden using the `--coverage` CLI option (default: `false`) |
| `--coverage.include <pattern>` | Files included in coverage as glob patterns. May be specified more than once when using multiple patterns (default: `**`) |
| `--coverage.exclude <pattern>` | Files to be excluded in coverage. May be specified more than once when using multiple extensions (default: Visit [`coverage.exclude`](https://vitest.dev/config/#coverage-exclude)) |
| `--coverage.extension <extension>` | Extension to be included in coverage. May be specified more than once when using multiple extensions (default: `[".js", ".cjs", ".mjs", ".ts", ".mts", ".cts", ".tsx", ".jsx", ".vue", ".svelte"]`) |
| `--coverage.clean` | Clean coverage results before running tests (default: true) |
| `--coverage.cleanOnRerun` | Clean coverage report on watch rerun (default: true) |
| `--coverage.reportsDirectory <path>` | Directory to write coverage report to (default: ./coverage) |
| `--coverage.reporter <name>` | Coverage reporters to use. Visit [`coverage.reporter`](https://vitest.dev/config/#coverage-reporter) for more information (default: `["text", "html", "clover", "json"]`) |
| `--coverage.reportOnFailure` | Generate coverage report even when tests fail (default: `false`) |
| `--coverage.allowExternal` | Collect coverage of files outside the project root (default: `false`) |
| `--coverage.skipFull` | Do not show files with 100% statement, branch, and function coverage (default: `false`) |
| `--coverage.thresholds.100` | Shortcut to set all coverage thresholds to 100 (default: `false`) |
| `--coverage.thresholds.perFile` | Check thresholds per file. See `--coverage.thresholds.lines`, `--coverage.thresholds.functions`, `--coverage.thresholds.branches` and `--coverage.thresholds.statements` for the actual thresholds (default: `false`) |
| `--coverage.thresholds.autoUpdate` | Update threshold values: "lines", "functions", "branches" and "statements" to configuration file when current coverage is above the configured thresholds (default: `false`) |
| `--coverage.thresholds.lines <number>` | Threshold for lines. Visit [istanbuljs](https://github.com/istanbuljs/nyc#coverage-thresholds) for more information. This option is not available for custom providers |
| `--coverage.thresholds.functions <number>` | Threshold for functions. Visit [istanbuljs](https://github.com/istanbuljs/nyc#coverage-thresholds) for more information. This option is not available for custom providers |
| `--coverage.thresholds.branches <number>` | Threshold for branches. Visit [istanbuljs](https://github.com/istanbuljs/nyc#coverage-thresholds) for more information. This option is not available for custom providers |
| `--coverage.thresholds.statements <number>` | Threshold for statements. Visit [istanbuljs](https://github.com/istanbuljs/nyc#coverage-thresholds) for more information. This option is not available for custom providers |
| `--coverage.ignoreClassMethods <name>` | Array of class method names to ignore for coverage. Visit [istanbuljs](https://github.com/istanbuljs/nyc#ignoring-methods) for more information. This option is only available for the istanbul providers (default: `[]`) |
| `--coverage.processingConcurrency <number>` | Concurrency limit used when processing the coverage results. (default min between 20 and the number of CPUs) |
| `--coverage.customProviderModule <path>` | Specifies the module name or path for the custom coverage provider module. Visit [Custom Coverage Provider](https://vitest.dev/guide/coverage#custom-coverage-provider) for more information. This option is only available for custom providers |
| `--coverage.watermarks.statements <watermarks>` | High and low watermarks for statements in the format of `<high>,<low>` |
| `--coverage.watermarks.lines <watermarks>` | High and low watermarks for lines in the format of `<high>,<low>` |
| `--coverage.watermarks.branches <watermarks>` | High and low watermarks for branches in the format of `<high>,<low>` |
| `--coverage.watermarks.functions <watermarks>` | High and low watermarks for functions in the format of `<high>,<low>` |
| `--mode <name>` | Override Vite mode (default: `test` or `benchmark`) |
| `--workspace <path>` | Path to a workspace configuration file |
| `--isolate` | Run every test file in isolation. To disable isolation, use `--no-isolate` (default: `true`) |
| `--globals` | Inject apis globally |
| `--dom` | Mock browser API with happy-dom |
| `--browser.enabled` | Run tests in the browser. Equivalent to `--browser.enabled` (default: `false`) |
| `--browser.name <name>` | Run all tests in a specific browser. Some browsers are only available for specific providers (see `--browser.provider`). Visit [`browser.name`](https://vitest.dev/config/#browser-name) for more information |
| `--browser.headless` | Run the browser in headless mode (i.e. without opening the GUI (Graphical User Interface)). If you are running Vitest in CI, it will be enabled by default (default: `process.env.CI`) |
| `--browser.api.port [port]` | Specify server port. Note if the port is already being used, Vite will automatically try the next available port so this may not be the actual port the server ends up listening on. If true will be set to `63315` |
| `--browser.api.host [host]` | Specify which IP addresses the server should listen on. Set this to `0.0.0.0` or `true` to listen on all addresses, including LAN and public addresses |
| `--browser.api.strictPort` | Set to true to exit if port is already in use, instead of automatically trying the next available port |
| `--browser.provider <name>` | Provider used to run browser tests. Some browsers are only available for specific providers. Can be "webdriverio", "playwright", or the path to a custom provider. Visit [`browser.provider`](https://vitest.dev/config/#browser-provider) for more information (default: `"webdriverio"`) |
| `--browser.providerOptions <options>` | Options that are passed down to a browser provider. Visit [`browser.providerOptions`](https://vitest.dev/config/#browser-provideroptions) for more information |
| `--browser.isolate` | Run every browser test file in isolation. To disable isolation, use `--browser.isolate=false` (default: `true`) |
| `--browser.ui` | Show Vitest UI when running tests (default: `!process.env.CI`) |
| `--pool <pool>` | Specify pool, if not running in the browser (default: `threads`) |
| `--poolOptions.threads.isolate` | Isolate tests in threads pool (default: `true`) |
| `--poolOptions.threads.singleThread` | Run tests inside a single thread (default: `false`) |
| `--poolOptions.threads.maxThreads <workers>` | Maximum number of threads to run tests in |
| `--poolOptions.threads.minThreads <workers>` | Minimum number of threads to run tests in |
| `--poolOptions.threads.useAtomics` | Use Atomics to synchronize threads. This can improve performance in some cases, but might cause segfault in older Node versions (default: `false`) |
| `--poolOptions.vmThreads.isolate` | Isolate tests in threads pool (default: `true`) |
| `--poolOptions.vmThreads.singleThread` | Run tests inside a single thread (default: `false`) |
| `--poolOptions.vmThreads.maxThreads <workers>` | Maximum number of threads to run tests in |
| `--poolOptions.vmThreads.minThreads <workers>` | Minimum number of threads to run tests in |
| `--poolOptions.vmThreads.useAtomics` | Use Atomics to synchronize threads. This can improve performance in some cases, but might cause segfault in older Node versions (default: `false`) |
| `--poolOptions.vmThreads.memoryLimit <limit>` | Memory limit for VM threads pool. If you see memory leaks, try to tinker this value. |
| `--poolOptions.forks.isolate` | Isolate tests in forks pool (default: `true`) |
| `--poolOptions.forks.singleFork` | Run tests inside a single child_process (default: `false`) |
| `--poolOptions.forks.maxForks <workers>` | Maximum number of processes to run tests in |
| `--poolOptions.forks.minForks <workers>` | Minimum number of processes to run tests in |
| `--poolOptions.vmForks.isolate` | Isolate tests in forks pool (default: `true`) |
| `--poolOptions.vmForks.singleFork` | Run tests inside a single child_process (default: `false`) |
| `--poolOptions.vmForks.maxForks <workers>` | Maximum number of processes to run tests in |
| `--poolOptions.vmForks.minForks <workers>` | Minimum number of processes to run tests in |
| `--poolOptions.vmForks.memoryLimit <limit>` | Memory limit for VM forks pool. If you see memory leaks, try to tinker this value. |
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
| `--sequence.shuffle.files` | Run files in a random order. Long running tests will not start earlier if you enable this option. (default: `false`) |
| `--sequence.shuffle.tests` | Run tests in a random oder (default: `false`) |
| `--sequence.concurrent` | Make tests run in parallel (default: `false`) |
| `--sequence.seed <seed>` | Set the randomization seed. This option will have no effect if --sequence.shuffle is falsy. Visit ["Random Seed" page](https://en.wikipedia.org/wiki/Random_seed) for more information |
| `--sequence.hooks <order>` | Changes the order in which hooks are executed. Accepted values are: "stack", "list" and "parallel". Visit [`sequence.hooks`](https://vitest.dev/config/#sequence-hooks) for more information (default: `"parallel"`) |
| `--sequence.setupFiles <order>` | Changes the order in which setup files are executed. Accepted values are: "list" and "parallel". If set to "list", will run setup files in the order they are defined. If set to "parallel", will run setup files in parallel (default: `"parallel"`) |
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
| `--typecheck.enabled` | Enable typechecking alongside tests (default: `false`) |
| `--typecheck.only` | Run only typecheck tests. This automatically enables typecheck (default: `false`) |
| `--typecheck.checker <name>` | Specify the typechecker to use. Available values are: "tcs" and "vue-tsc" and a path to an executable (default: `"tsc"`) |
| `--typecheck.allowJs` | Allow JavaScript files to be typechecked. By default takes the value from tsconfig.json |
| `--typecheck.ignoreSourceErrors` | Ignore type errors from source files |
| `--typecheck.tsconfig <path>` | Path to a custom tsconfig file |
| `--project <name>` | The name of the project to run if you are using Vitest workspace feature. This can be repeated for multiple projects: `--project=1 --project=2`. You can also filter projects using wildcards like `--project=packages*` |
| `--slowTestThreshold <threshold>` | Threshold in milliseconds for a test to be considered slow (default: `300`) |
| `--teardownTimeout <timeout>` | Default timeout of a teardown function in milliseconds (default: `10000`) |
| `--maxConcurrency <number>` | Maximum number of concurrent tests in a suite (default: `5`) |
| `--run` | Disable watch mode |
| `--no-color` | Removes colors from the console output |
| `--clearScreen` | Clear terminal screen when re-running tests during watch mode (default: `true`) |
| `--standalone` | Start Vitest without running tests. File filters will be ignored, tests will be running only on change (default: `false`) |
| `--mergeReports [path]` | Paths to blob reports directory. If this options is used, Vitest won't run any tests, it will only report previously recorded tests |
