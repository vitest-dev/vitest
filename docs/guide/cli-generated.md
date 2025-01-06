### root

- **CLI:** `-r, --root <path>`
- **Config:** [root](/config/#root)

Root path

### config

- **CLI:** `-c, --config <path>`

Path to config file

### update

- **CLI:** `-u, --update`
- **Config:** [update](/config/#update)

Update snapshot

### watch

- **CLI:** `-w, --watch`
- **Config:** [watch](/config/#watch)

Enable watch mode

### testNamePattern

- **CLI:** `-t, --testNamePattern <pattern>`
- **Config:** [testNamePattern](/config/#testnamepattern)

Run tests with full names matching the specified regexp pattern

### dir

- **CLI:** `--dir <path>`
- **Config:** [dir](/config/#dir)

Base directory to scan for the test files

### ui

- **CLI:** `--ui`
- **Config:** [ui](/config/#ui)

Enable UI

### open

- **CLI:** `--open`
- **Config:** [open](/config/#open)

Open UI automatically (default: `!process.env.CI`)

### api.port

- **CLI:** `--api.port [port]`

Specify server port. Note if the port is already being used, Vite will automatically try the next available port so this may not be the actual port the server ends up listening on. If true will be set to `51204`

### api.host

- **CLI:** `--api.host [host]`

Specify which IP addresses the server should listen on. Set this to `0.0.0.0` or `true` to listen on all addresses, including LAN and public addresses

### api.strictPort

- **CLI:** `--api.strictPort`

Set to true to exit if port is already in use, instead of automatically trying the next available port

### silent

- **CLI:** `--silent`
- **Config:** [silent](/config/#silent)

Silent console output from tests

### hideSkippedTests

- **CLI:** `--hideSkippedTests`

Hide logs for skipped tests

### reporters

- **CLI:** `--reporter <name>`
- **Config:** [reporters](/config/#reporters)

Specify reporters

### outputFile

- **CLI:** `--outputFile <filename/-s>`
- **Config:** [outputFile](/config/#outputfile)

Write test results to a file when supporter reporter is also specified, use cac's dot notation for individual outputs of multiple reporters (example: `--outputFile.tap=./tap.txt`)

### coverage.all

- **CLI:** `--coverage.all`
- **Config:** [coverage.all](/config/#coverage-all)

Whether to include all files, including the untested ones into report

### coverage.provider

- **CLI:** `--coverage.provider <name>`
- **Config:** [coverage.provider](/config/#coverage-provider)

Select the tool for coverage collection, available values are: "v8", "istanbul" and "custom"

### coverage.enabled

- **CLI:** `--coverage.enabled`
- **Config:** [coverage.enabled](/config/#coverage-enabled)

Enables coverage collection. Can be overridden using the `--coverage` CLI option (default: `false`)

### coverage.include

- **CLI:** `--coverage.include <pattern>`
- **Config:** [coverage.include](/config/#coverage-include)

Files included in coverage as glob patterns. May be specified more than once when using multiple patterns (default: `**`)

### coverage.exclude

- **CLI:** `--coverage.exclude <pattern>`
- **Config:** [coverage.exclude](/config/#coverage-exclude)

Files to be excluded in coverage. May be specified more than once when using multiple extensions (default: Visit [`coverage.exclude`](https://vitest.dev/config/#coverage-exclude))

### coverage.extension

- **CLI:** `--coverage.extension <extension>`
- **Config:** [coverage.extension](/config/#coverage-extension)

Extension to be included in coverage. May be specified more than once when using multiple extensions (default: `[".js", ".cjs", ".mjs", ".ts", ".mts", ".tsx", ".jsx", ".vue", ".svelte"]`)

### coverage.clean

- **CLI:** `--coverage.clean`
- **Config:** [coverage.clean](/config/#coverage-clean)

Clean coverage results before running tests (default: true)

### coverage.cleanOnRerun

- **CLI:** `--coverage.cleanOnRerun`
- **Config:** [coverage.cleanOnRerun](/config/#coverage-cleanonrerun)

Clean coverage report on watch rerun (default: true)

### coverage.reportsDirectory

- **CLI:** `--coverage.reportsDirectory <path>`
- **Config:** [coverage.reportsDirectory](/config/#coverage-reportsdirectory)

Directory to write coverage report to (default: ./coverage)

### coverage.reporter

- **CLI:** `--coverage.reporter <name>`
- **Config:** [coverage.reporter](/config/#coverage-reporter)

Coverage reporters to use. Visit [`coverage.reporter`](https://vitest.dev/config/#coverage-reporter) for more information (default: `["text", "html", "clover", "json"]`)

### coverage.reportOnFailure

- **CLI:** `--coverage.reportOnFailure`
- **Config:** [coverage.reportOnFailure](/config/#coverage-reportonfailure)

Generate coverage report even when tests fail (default: `false`)

### coverage.allowExternal

- **CLI:** `--coverage.allowExternal`
- **Config:** [coverage.allowExternal](/config/#coverage-allowexternal)

Collect coverage of files outside the project root (default: `false`)

### coverage.skipFull

- **CLI:** `--coverage.skipFull`
- **Config:** [coverage.skipFull](/config/#coverage-skipfull)

Do not show files with 100% statement, branch, and function coverage (default: `false`)

### coverage.thresholds.100

- **CLI:** `--coverage.thresholds.100`
- **Config:** [coverage.thresholds.100](/config/#coverage-thresholds-100)

Shortcut to set all coverage thresholds to 100 (default: `false`)

### coverage.thresholds.perFile

- **CLI:** `--coverage.thresholds.perFile`
- **Config:** [coverage.thresholds.perFile](/config/#coverage-thresholds-perfile)

Check thresholds per file. See `--coverage.thresholds.lines`, `--coverage.thresholds.functions`, `--coverage.thresholds.branches` and `--coverage.thresholds.statements` for the actual thresholds (default: `false`)

### coverage.thresholds.autoUpdate

- **CLI:** `--coverage.thresholds.autoUpdate`
- **Config:** [coverage.thresholds.autoUpdate](/config/#coverage-thresholds-autoupdate)

Update threshold values: "lines", "functions", "branches" and "statements" to configuration file when current coverage is above the configured thresholds (default: `false`)

### coverage.thresholds.lines

- **CLI:** `--coverage.thresholds.lines <number>`

Threshold for lines. Visit [istanbuljs](https://github.com/istanbuljs/nyc#coverage-thresholds) for more information. This option is not available for custom providers

### coverage.thresholds.functions

- **CLI:** `--coverage.thresholds.functions <number>`

Threshold for functions. Visit [istanbuljs](https://github.com/istanbuljs/nyc#coverage-thresholds) for more information. This option is not available for custom providers

### coverage.thresholds.branches

- **CLI:** `--coverage.thresholds.branches <number>`

Threshold for branches. Visit [istanbuljs](https://github.com/istanbuljs/nyc#coverage-thresholds) for more information. This option is not available for custom providers

### coverage.thresholds.statements

- **CLI:** `--coverage.thresholds.statements <number>`

Threshold for statements. Visit [istanbuljs](https://github.com/istanbuljs/nyc#coverage-thresholds) for more information. This option is not available for custom providers

### coverage.ignoreClassMethods

- **CLI:** `--coverage.ignoreClassMethods <name>`
- **Config:** [coverage.ignoreClassMethods](/config/#coverage-ignoreclassmethods)

Array of class method names to ignore for coverage. Visit [istanbuljs](https://github.com/istanbuljs/nyc#ignoring-methods) for more information. This option is only available for the istanbul providers (default: `[]`)

### coverage.processingConcurrency

- **CLI:** `--coverage.processingConcurrency <number>`
- **Config:** [coverage.processingConcurrency](/config/#coverage-processingconcurrency)

Concurrency limit used when processing the coverage results. (default min between 20 and the number of CPUs)

### coverage.customProviderModule

- **CLI:** `--coverage.customProviderModule <path>`
- **Config:** [coverage.customProviderModule](/config/#coverage-customprovidermodule)

Specifies the module name or path for the custom coverage provider module. Visit [Custom Coverage Provider](https://vitest.dev/guide/coverage#custom-coverage-provider) for more information. This option is only available for custom providers

### coverage.watermarks.statements

- **CLI:** `--coverage.watermarks.statements <watermarks>`

High and low watermarks for statements in the format of `<high>,<low>`

### coverage.watermarks.lines

- **CLI:** `--coverage.watermarks.lines <watermarks>`

High and low watermarks for lines in the format of `<high>,<low>`

### coverage.watermarks.branches

- **CLI:** `--coverage.watermarks.branches <watermarks>`

High and low watermarks for branches in the format of `<high>,<low>`

### coverage.watermarks.functions

- **CLI:** `--coverage.watermarks.functions <watermarks>`

High and low watermarks for functions in the format of `<high>,<low>`

### mode

- **CLI:** `--mode <name>`
- **Config:** [mode](/config/#mode)

Override Vite mode (default: `test` or `benchmark`)

### workspace

- **CLI:** `--workspace <path>`
- **Config:** [workspace](/config/#workspace)

Path to a workspace configuration file

### isolate

- **CLI:** `--isolate`
- **Config:** [isolate](/config/#isolate)

Run every test file in isolation. To disable isolation, use `--no-isolate` (default: `true`)

### globals

- **CLI:** `--globals`
- **Config:** [globals](/config/#globals)

Inject apis globally

### dom

- **CLI:** `--dom`

Mock browser API with happy-dom

### browser.enabled

- **CLI:** `--browser.enabled`
- **Config:** [browser.enabled](/guide/browser/config#browser-enabled)

Run tests in the browser. Equivalent to `--browser.enabled` (default: `false`)

### browser.name

- **CLI:** `--browser.name <name>`
- **Config:** [browser.name](/guide/browser/config#browser-name)

Run all tests in a specific browser. Some browsers are only available for specific providers (see `--browser.provider`). Visit [`browser.name`](https://vitest.dev/guide/browser/config/#browser-name) for more information

### browser.headless

- **CLI:** `--browser.headless`
- **Config:** [browser.headless](/guide/browser/config#browser-headless)

Run the browser in headless mode (i.e. without opening the GUI (Graphical User Interface)). If you are running Vitest in CI, it will be enabled by default (default: `process.env.CI`)

### browser.api.port

- **CLI:** `--browser.api.port [port]`
- **Config:** [browser.api.port](/guide/browser/config#browser-api-port)

Specify server port. Note if the port is already being used, Vite will automatically try the next available port so this may not be the actual port the server ends up listening on. If true will be set to `63315`

### browser.api.host

- **CLI:** `--browser.api.host [host]`
- **Config:** [browser.api.host](/guide/browser/config#browser-api-host)

Specify which IP addresses the server should listen on. Set this to `0.0.0.0` or `true` to listen on all addresses, including LAN and public addresses

### browser.api.strictPort

- **CLI:** `--browser.api.strictPort`
- **Config:** [browser.api.strictPort](/guide/browser/config#browser-api-strictport)

Set to true to exit if port is already in use, instead of automatically trying the next available port

### browser.provider

- **CLI:** `--browser.provider <name>`
- **Config:** [browser.provider](/guide/browser/config#browser-provider)

Provider used to run browser tests. Some browsers are only available for specific providers. Can be "webdriverio", "playwright", "preview", or the path to a custom provider. Visit [`browser.provider`](https://vitest.dev/config/#browser-provider) for more information (default: `"preview"`)

### browser.providerOptions

- **CLI:** `--browser.providerOptions <options>`
- **Config:** [browser.providerOptions](/guide/browser/config#browser-provideroptions)

Options that are passed down to a browser provider. Visit [`browser.providerOptions`](https://vitest.dev/config/#browser-provideroptions) for more information

### browser.isolate

- **CLI:** `--browser.isolate`
- **Config:** [browser.isolate](/guide/browser/config#browser-isolate)

Run every browser test file in isolation. To disable isolation, use `--browser.isolate=false` (default: `true`)

### browser.ui

- **CLI:** `--browser.ui`
- **Config:** [browser.ui](/guide/browser/config#browser-ui)

Show Vitest UI when running tests (default: `!process.env.CI`)

### browser.fileParallelism

- **CLI:** `--browser.fileParallelism`
- **Config:** [browser.fileParallelism](/guide/browser/config#browser-fileparallelism)

Should browser test files run in parallel. Use `--browser.fileParallelism=false` to disable (default: `true`)

### browser.connectTimeout

- **CLI:** `--browser.connectTimeout <timeout>`
- **Config:** [browser.connectTimeout](/guide/browser/config#browser-connecttimeout)

If connection to the browser takes longer, the test suite will fail (default: `60_000`)

### pool

- **CLI:** `--pool <pool>`
- **Config:** [pool](/config/#pool)

Specify pool, if not running in the browser (default: `forks`)

### poolOptions.threads.isolate

- **CLI:** `--poolOptions.threads.isolate`
- **Config:** [poolOptions.threads.isolate](/config/#pooloptions-threads-isolate)

Isolate tests in threads pool (default: `true`)

### poolOptions.threads.singleThread

- **CLI:** `--poolOptions.threads.singleThread`
- **Config:** [poolOptions.threads.singleThread](/config/#pooloptions-threads-singlethread)

Run tests inside a single thread (default: `false`)

### poolOptions.threads.maxThreads

- **CLI:** `--poolOptions.threads.maxThreads <workers>`
- **Config:** [poolOptions.threads.maxThreads](/config/#pooloptions-threads-maxthreads)

Maximum number or percentage of threads to run tests in

### poolOptions.threads.minThreads

- **CLI:** `--poolOptions.threads.minThreads <workers>`
- **Config:** [poolOptions.threads.minThreads](/config/#pooloptions-threads-minthreads)

Minimum number or percentage of threads to run tests in

### poolOptions.threads.useAtomics

- **CLI:** `--poolOptions.threads.useAtomics`
- **Config:** [poolOptions.threads.useAtomics](/config/#pooloptions-threads-useatomics)

Use Atomics to synchronize threads. This can improve performance in some cases, but might cause segfault in older Node versions (default: `false`)

### poolOptions.vmThreads.isolate

- **CLI:** `--poolOptions.vmThreads.isolate`
- **Config:** [poolOptions.vmThreads.isolate](/config/#pooloptions-vmthreads-isolate)

Isolate tests in threads pool (default: `true`)

### poolOptions.vmThreads.singleThread

- **CLI:** `--poolOptions.vmThreads.singleThread`
- **Config:** [poolOptions.vmThreads.singleThread](/config/#pooloptions-vmthreads-singlethread)

Run tests inside a single thread (default: `false`)

### poolOptions.vmThreads.maxThreads

- **CLI:** `--poolOptions.vmThreads.maxThreads <workers>`
- **Config:** [poolOptions.vmThreads.maxThreads](/config/#pooloptions-vmthreads-maxthreads)

Maximum number or percentage of threads to run tests in

### poolOptions.vmThreads.minThreads

- **CLI:** `--poolOptions.vmThreads.minThreads <workers>`
- **Config:** [poolOptions.vmThreads.minThreads](/config/#pooloptions-vmthreads-minthreads)

Minimum number or percentage of threads to run tests in

### poolOptions.vmThreads.useAtomics

- **CLI:** `--poolOptions.vmThreads.useAtomics`
- **Config:** [poolOptions.vmThreads.useAtomics](/config/#pooloptions-vmthreads-useatomics)

Use Atomics to synchronize threads. This can improve performance in some cases, but might cause segfault in older Node versions (default: `false`)

### poolOptions.vmThreads.memoryLimit

- **CLI:** `--poolOptions.vmThreads.memoryLimit <limit>`
- **Config:** [poolOptions.vmThreads.memoryLimit](/config/#pooloptions-vmthreads-memorylimit)

Memory limit for VM threads pool. If you see memory leaks, try to tinker this value.

### poolOptions.forks.isolate

- **CLI:** `--poolOptions.forks.isolate`
- **Config:** [poolOptions.forks.isolate](/config/#pooloptions-forks-isolate)

Isolate tests in forks pool (default: `true`)

### poolOptions.forks.singleFork

- **CLI:** `--poolOptions.forks.singleFork`
- **Config:** [poolOptions.forks.singleFork](/config/#pooloptions-forks-singlefork)

Run tests inside a single child_process (default: `false`)

### poolOptions.forks.maxForks

- **CLI:** `--poolOptions.forks.maxForks <workers>`
- **Config:** [poolOptions.forks.maxForks](/config/#pooloptions-forks-maxforks)

Maximum number or percentage of processes to run tests in

### poolOptions.forks.minForks

- **CLI:** `--poolOptions.forks.minForks <workers>`
- **Config:** [poolOptions.forks.minForks](/config/#pooloptions-forks-minforks)

Minimum number or percentage of processes to run tests in

### poolOptions.vmForks.isolate

- **CLI:** `--poolOptions.vmForks.isolate`
- **Config:** [poolOptions.vmForks.isolate](/config/#pooloptions-vmforks-isolate)

Isolate tests in forks pool (default: `true`)

### poolOptions.vmForks.singleFork

- **CLI:** `--poolOptions.vmForks.singleFork`
- **Config:** [poolOptions.vmForks.singleFork](/config/#pooloptions-vmforks-singlefork)

Run tests inside a single child_process (default: `false`)

### poolOptions.vmForks.maxForks

- **CLI:** `--poolOptions.vmForks.maxForks <workers>`
- **Config:** [poolOptions.vmForks.maxForks](/config/#pooloptions-vmforks-maxforks)

Maximum number or percentage of processes to run tests in

### poolOptions.vmForks.minForks

- **CLI:** `--poolOptions.vmForks.minForks <workers>`
- **Config:** [poolOptions.vmForks.minForks](/config/#pooloptions-vmforks-minforks)

Minimum number or percentage of processes to run tests in

### poolOptions.vmForks.memoryLimit

- **CLI:** `--poolOptions.vmForks.memoryLimit <limit>`
- **Config:** [poolOptions.vmForks.memoryLimit](/config/#pooloptions-vmforks-memorylimit)

Memory limit for VM forks pool. If you see memory leaks, try to tinker this value.

### fileParallelism

- **CLI:** `--fileParallelism`
- **Config:** [fileParallelism](/config/#fileparallelism)

Should all test files run in parallel. Use `--no-file-parallelism` to disable (default: `true`)

### maxWorkers

- **CLI:** `--maxWorkers <workers>`
- **Config:** [maxWorkers](/config/#maxworkers)

Maximum number or percentage of workers to run tests in

### minWorkers

- **CLI:** `--minWorkers <workers>`
- **Config:** [minWorkers](/config/#minworkers)

Minimum number or percentage of workers to run tests in

### environment

- **CLI:** `--environment <name>`
- **Config:** [environment](/config/#environment)

Specify runner environment, if not running in the browser (default: `node`)

### passWithNoTests

- **CLI:** `--passWithNoTests`
- **Config:** [passWithNoTests](/config/#passwithnotests)

Pass when no tests are found

### logHeapUsage

- **CLI:** `--logHeapUsage`
- **Config:** [logHeapUsage](/config/#logheapusage)

Show the size of heap for each test when running in node

### allowOnly

- **CLI:** `--allowOnly`
- **Config:** [allowOnly](/config/#allowonly)

Allow tests and suites that are marked as only (default: `!process.env.CI`)

### dangerouslyIgnoreUnhandledErrors

- **CLI:** `--dangerouslyIgnoreUnhandledErrors`
- **Config:** [dangerouslyIgnoreUnhandledErrors](/config/#dangerouslyignoreunhandlederrors)

Ignore any unhandled errors that occur

### sequence.shuffle.files

- **CLI:** `--sequence.shuffle.files`
- **Config:** [sequence.shuffle.files](/config/#sequence-shuffle-files)

Run files in a random order. Long running tests will not start earlier if you enable this option. (default: `false`)

### sequence.shuffle.tests

- **CLI:** `--sequence.shuffle.tests`
- **Config:** [sequence.shuffle.tests](/config/#sequence-shuffle-tests)

Run tests in a random order (default: `false`)

### sequence.concurrent

- **CLI:** `--sequence.concurrent`
- **Config:** [sequence.concurrent](/config/#sequence-concurrent)

Make tests run in parallel (default: `false`)

### sequence.seed

- **CLI:** `--sequence.seed <seed>`
- **Config:** [sequence.seed](/config/#sequence-seed)

Set the randomization seed. This option will have no effect if `--sequence.shuffle` is falsy. Visit ["Random Seed" page](https://en.wikipedia.org/wiki/Random_seed) for more information

### sequence.hooks

- **CLI:** `--sequence.hooks <order>`
- **Config:** [sequence.hooks](/config/#sequence-hooks)

Changes the order in which hooks are executed. Accepted values are: "stack", "list" and "parallel". Visit [`sequence.hooks`](https://vitest.dev/config/#sequence-hooks) for more information (default: `"parallel"`)

### sequence.setupFiles

- **CLI:** `--sequence.setupFiles <order>`
- **Config:** [sequence.setupFiles](/config/#sequence-setupfiles)

Changes the order in which setup files are executed. Accepted values are: "list" and "parallel". If set to "list", will run setup files in the order they are defined. If set to "parallel", will run setup files in parallel (default: `"parallel"`)

### inspect

- **CLI:** `--inspect [[host:]port]`
- **Config:** [inspect](/config/#inspect)

Enable Node.js inspector (default: `127.0.0.1:9229`)

### inspectBrk

- **CLI:** `--inspectBrk [[host:]port]`
- **Config:** [inspectBrk](/config/#inspectbrk)

Enable Node.js inspector and break before the test starts

### testTimeout

- **CLI:** `--testTimeout <timeout>`
- **Config:** [testTimeout](/config/#testtimeout)

Default timeout of a test in milliseconds (default: `5000`). Use `0` to disable timeout completely.

### hookTimeout

- **CLI:** `--hookTimeout <timeout>`
- **Config:** [hookTimeout](/config/#hooktimeout)

Default hook timeout in milliseconds (default: `10000`). Use `0` to disable timeout completely.

### bail

- **CLI:** `--bail <number>`
- **Config:** [bail](/config/#bail)

Stop test execution when given number of tests have failed (default: `0`)

### retry

- **CLI:** `--retry <times>`
- **Config:** [retry](/config/#retry)

Retry the test specific number of times if it fails (default: `0`)

### diff.aAnnotation

- **CLI:** `--diff.aAnnotation <annotation>`
- **Config:** [diff.aAnnotation](/config/#diff-aannotation)

Annotation for expected lines (default: `Expected`)

### diff.aIndicator

- **CLI:** `--diff.aIndicator <indicator>`
- **Config:** [diff.aIndicator](/config/#diff-aindicator)

Indicator for expected lines (default: `-`)

### diff.bAnnotation

- **CLI:** `--diff.bAnnotation <annotation>`
- **Config:** [diff.bAnnotation](/config/#diff-bannotation)

Annotation for received lines (default: `Received`)

### diff.bIndicator

- **CLI:** `--diff.bIndicator <indicator>`
- **Config:** [diff.bIndicator](/config/#diff-bindicator)

Indicator for received lines (default: `+`)

### diff.commonIndicator

- **CLI:** `--diff.commonIndicator <indicator>`
- **Config:** [diff.commonIndicator](/config/#diff-commonindicator)

Indicator for common lines (default: ` `)

### diff.contextLines

- **CLI:** `--diff.contextLines <lines>`
- **Config:** [diff.contextLines](/config/#diff-contextlines)

Number of lines of context to show around each change (default: `5`)

### diff.emptyFirstOrLastLinePlaceholder

- **CLI:** `--diff.emptyFirstOrLastLinePlaceholder <placeholder>`
- **Config:** [diff.emptyFirstOrLastLinePlaceholder](/config/#diff-emptyfirstorlastlineplaceholder)

Placeholder for an empty first or last line (default: `""`)

### diff.expand

- **CLI:** `--diff.expand`
- **Config:** [diff.expand](/config/#diff-expand)

Expand all common lines (default: `true`)

### diff.includeChangeCounts

- **CLI:** `--diff.includeChangeCounts`
- **Config:** [diff.includeChangeCounts](/config/#diff-includechangecounts)

Include comparison counts in diff output (default: `false`)

### diff.omitAnnotationLines

- **CLI:** `--diff.omitAnnotationLines`
- **Config:** [diff.omitAnnotationLines](/config/#diff-omitannotationlines)

Omit annotation lines from the output (default: `false`)

### diff.printBasicPrototype

- **CLI:** `--diff.printBasicPrototype`
- **Config:** [diff.printBasicPrototype](/config/#diff-printbasicprototype)

Print basic prototype Object and Array (default: `true`)

### diff.truncateThreshold

- **CLI:** `--diff.truncateThreshold <threshold>`
- **Config:** [diff.truncateThreshold](/config/#diff-truncatethreshold)

Number of lines to show before and after each change (default: `0`)

### diff.truncateAnnotation

- **CLI:** `--diff.truncateAnnotation <annotation>`
- **Config:** [diff.truncateAnnotation](/config/#diff-truncateannotation)

Annotation for truncated lines (default: `... Diff result is truncated`)

### exclude

- **CLI:** `--exclude <glob>`
- **Config:** [exclude](/config/#exclude)

Additional file globs to be excluded from test

### expandSnapshotDiff

- **CLI:** `--expandSnapshotDiff`
- **Config:** [expandSnapshotDiff](/config/#expandsnapshotdiff)

Show full diff when snapshot fails

### disableConsoleIntercept

- **CLI:** `--disableConsoleIntercept`
- **Config:** [disableConsoleIntercept](/config/#disableconsoleintercept)

Disable automatic interception of console logging (default: `false`)

### typecheck.enabled

- **CLI:** `--typecheck.enabled`
- **Config:** [typecheck.enabled](/config/#typecheck-enabled)

Enable typechecking alongside tests (default: `false`)

### typecheck.only

- **CLI:** `--typecheck.only`
- **Config:** [typecheck.only](/config/#typecheck-only)

Run only typecheck tests. This automatically enables typecheck (default: `false`)

### typecheck.checker

- **CLI:** `--typecheck.checker <name>`
- **Config:** [typecheck.checker](/config/#typecheck-checker)

Specify the typechecker to use. Available values are: "tsc" and "vue-tsc" and a path to an executable (default: `"tsc"`)

### typecheck.allowJs

- **CLI:** `--typecheck.allowJs`
- **Config:** [typecheck.allowJs](/config/#typecheck-allowjs)

Allow JavaScript files to be typechecked. By default takes the value from tsconfig.json

### typecheck.ignoreSourceErrors

- **CLI:** `--typecheck.ignoreSourceErrors`
- **Config:** [typecheck.ignoreSourceErrors](/config/#typecheck-ignoresourceerrors)

Ignore type errors from source files

### typecheck.tsconfig

- **CLI:** `--typecheck.tsconfig <path>`
- **Config:** [typecheck.tsconfig](/config/#typecheck-tsconfig)

Path to a custom tsconfig file

### project

- **CLI:** `--project <name>`
- **Config:** [project](/config/#project)

The name of the project to run if you are using Vitest workspace feature. This can be repeated for multiple projects: `--project=1 --project=2`. You can also filter projects using wildcards like `--project=packages*`, and exclude projects with `--project=!pattern`.

### slowTestThreshold

- **CLI:** `--slowTestThreshold <threshold>`
- **Config:** [slowTestThreshold](/config/#slowtestthreshold)

Threshold in milliseconds for a test or suite to be considered slow (default: `300`)

### teardownTimeout

- **CLI:** `--teardownTimeout <timeout>`
- **Config:** [teardownTimeout](/config/#teardowntimeout)

Default timeout of a teardown function in milliseconds (default: `10000`)

### maxConcurrency

- **CLI:** `--maxConcurrency <number>`
- **Config:** [maxConcurrency](/config/#maxconcurrency)

Maximum number of concurrent tests in a suite (default: `5`)

### expect.requireAssertions

- **CLI:** `--expect.requireAssertions`
- **Config:** [expect.requireAssertions](/config/#expect-requireassertions)

Require that all tests have at least one assertion

### expect.poll.interval

- **CLI:** `--expect.poll.interval <interval>`
- **Config:** [expect.poll.interval](/config/#expect-poll-interval)

Poll interval in milliseconds for `expect.poll()` assertions (default: `50`)

### expect.poll.timeout

- **CLI:** `--expect.poll.timeout <timeout>`
- **Config:** [expect.poll.timeout](/config/#expect-poll-timeout)

Poll timeout in milliseconds for `expect.poll()` assertions (default: `1000`)

### printConsoleTrace

- **CLI:** `--printConsoleTrace`
- **Config:** [printConsoleTrace](/config/#printconsoletrace)

Always print console stack traces

### includeTaskLocation

- **CLI:** `--includeTaskLocation`
- **Config:** [includeTaskLocation](/config/#includetasklocation)

Collect test and suite locations in the `location` property

### run

- **CLI:** `--run`

Disable watch mode

### color

- **CLI:** `--no-color`

Removes colors from the console output

### clearScreen

- **CLI:** `--clearScreen`

Clear terminal screen when re-running tests during watch mode (default: `true`)

### standalone

- **CLI:** `--standalone`

Start Vitest without running tests. File filters will be ignored, tests will be running only on change (default: `false`)
