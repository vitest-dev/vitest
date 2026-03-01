### root

- **CLI:** `-r, --root <path>`
- **Config:** [root](/config/root)

Root path

### config

- **CLI:** `-c, --config <path>`

Path to config file

### update

- **CLI:** `-u, --update [type]`
- **Config:** [update](/config/update)

Update snapshot (accepts boolean, "new", "all" or "none")

### watch

- **CLI:** `-w, --watch`
- **Config:** [watch](/config/watch)

Enable watch mode

### testNamePattern

- **CLI:** `-t, --testNamePattern <pattern>`
- **Config:** [testNamePattern](/config/testnamepattern)

Run tests with full names matching the specified regexp pattern

### dir

- **CLI:** `--dir <path>`
- **Config:** [dir](/config/dir)

Base directory to scan for the test files

### ui

- **CLI:** `--ui`

Enable UI

### open

- **CLI:** `--open`
- **Config:** [open](/config/open)

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

### api.allowExec

- **CLI:** `--api.allowExec`
- **Config:** [api.allowExec](/config/api#api-allowexec)

Allow API to execute code. (Be careful when enabling this option in untrusted environments)

### api.allowWrite

- **CLI:** `--api.allowWrite`
- **Config:** [api.allowWrite](/config/api#api-allowwrite)

Allow API to edit files. (Be careful when enabling this option in untrusted environments)

### silent

- **CLI:** `--silent [value]`
- **Config:** [silent](/config/silent)

Silent console output from tests. Use `'passed-only'` to see logs from failing tests only.

### hideSkippedTests

- **CLI:** `--hideSkippedTests`

Hide logs for skipped tests

### reporters

- **CLI:** `--reporter <name>`
- **Config:** [reporters](/config/reporters)

Specify reporters (default, blob, verbose, dot, json, tap, tap-flat, junit, tree, hanging-process, github-actions)

### outputFile

- **CLI:** `--outputFile <filename/-s>`
- **Config:** [outputFile](/config/outputfile)

Write test results to a file when supporter reporter is also specified, use cac's dot notation for individual outputs of multiple reporters (example: `--outputFile.tap=./tap.txt`)

### coverage.provider

- **CLI:** `--coverage.provider <name>`
- **Config:** [coverage.provider](/config/coverage#coverage-provider)

Select the tool for coverage collection, available values are: "v8", "istanbul" and "custom"

### coverage.enabled

- **CLI:** `--coverage.enabled`
- **Config:** [coverage.enabled](/config/coverage#coverage-enabled)

Enables coverage collection. Can be overridden using the `--coverage` CLI option (default: `false`)

### coverage.include

- **CLI:** `--coverage.include <pattern>`
- **Config:** [coverage.include](/config/coverage#coverage-include)

Files included in coverage as glob patterns. May be specified more than once when using multiple patterns. By default only files covered by tests are included.

### coverage.exclude

- **CLI:** `--coverage.exclude <pattern>`
- **Config:** [coverage.exclude](/config/coverage#coverage-exclude)

Files to be excluded in coverage. May be specified more than once when using multiple extensions.

### coverage.clean

- **CLI:** `--coverage.clean`
- **Config:** [coverage.clean](/config/coverage#coverage-clean)

Clean coverage results before running tests (default: true)

### coverage.cleanOnRerun

- **CLI:** `--coverage.cleanOnRerun`
- **Config:** [coverage.cleanOnRerun](/config/coverage#coverage-cleanonrerun)

Clean coverage report on watch rerun (default: true)

### coverage.reportsDirectory

- **CLI:** `--coverage.reportsDirectory <path>`
- **Config:** [coverage.reportsDirectory](/config/coverage#coverage-reportsdirectory)

Directory to write coverage report to (default: ./coverage)

### coverage.reporter

- **CLI:** `--coverage.reporter <name>`
- **Config:** [coverage.reporter](/config/coverage#coverage-reporter)

Coverage reporters to use. Visit [`coverage.reporter`](/config/coverage#coverage-reporter) for more information (default: `["text", "html", "clover", "json"]`)

### coverage.reportOnFailure

- **CLI:** `--coverage.reportOnFailure`
- **Config:** [coverage.reportOnFailure](/config/coverage#coverage-reportonfailure)

Generate coverage report even when tests fail (default: `false`)

### coverage.allowExternal

- **CLI:** `--coverage.allowExternal`
- **Config:** [coverage.allowExternal](/config/coverage#coverage-allowexternal)

Collect coverage of files outside the project root (default: `false`)

### coverage.skipFull

- **CLI:** `--coverage.skipFull`
- **Config:** [coverage.skipFull](/config/coverage#coverage-skipfull)

Do not show files with 100% statement, branch, and function coverage (default: `false`)

### coverage.thresholds.100

- **CLI:** `--coverage.thresholds.100`
- **Config:** [coverage.thresholds.100](/config/coverage#coverage-thresholds-100)

Shortcut to set all coverage thresholds to 100 (default: `false`)

### coverage.thresholds.perFile

- **CLI:** `--coverage.thresholds.perFile`
- **Config:** [coverage.thresholds.perFile](/config/coverage#coverage-thresholds-perfile)

Check thresholds per file. See `--coverage.thresholds.lines`, `--coverage.thresholds.functions`, `--coverage.thresholds.branches` and `--coverage.thresholds.statements` for the actual thresholds (default: `false`)

### coverage.thresholds.autoUpdate

- **CLI:** `--coverage.thresholds.autoUpdate <boolean|function>`
- **Config:** [coverage.thresholds.autoUpdate](/config/coverage#coverage-thresholds-autoupdate)

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
- **Config:** [coverage.ignoreClassMethods](/config/coverage#coverage-ignoreclassmethods)

Array of class method names to ignore for coverage. Visit [istanbuljs](https://github.com/istanbuljs/nyc#ignoring-methods) for more information. This option is only available for the istanbul providers (default: `[]`)

### coverage.processingConcurrency

- **CLI:** `--coverage.processingConcurrency <number>`
- **Config:** [coverage.processingConcurrency](/config/coverage#coverage-processingconcurrency)

Concurrency limit used when processing the coverage results. (default min between 20 and the number of CPUs)

### coverage.customProviderModule

- **CLI:** `--coverage.customProviderModule <path>`
- **Config:** [coverage.customProviderModule](/config/coverage#coverage-customprovidermodule)

Specifies the module name or path for the custom coverage provider module. Visit [Custom Coverage Provider](/guide/coverage#custom-coverage-provider) for more information. This option is only available for custom providers

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

### coverage.changed

- **CLI:** `--coverage.changed <commit/branch>`
- **Config:** [coverage.changed](/config/coverage#coverage-changed)

Collect coverage only for files changed since a specified commit or branch (e.g., `origin/main` or `HEAD~1`). Inherits value from `--changed` by default.

### mode

- **CLI:** `--mode <name>`
- **Config:** [mode](/config/mode)

Override Vite mode (default: `test` or `benchmark`)

### isolate

- **CLI:** `--isolate`
- **Config:** [isolate](/config/isolate)

Run every test file in isolation. To disable isolation, use `--no-isolate` (default: `true`)

### globals

- **CLI:** `--globals`
- **Config:** [globals](/config/globals)

Inject apis globally

### dom

- **CLI:** `--dom`

Mock browser API with happy-dom

### browser.enabled

- **CLI:** `--browser.enabled`
- **Config:** [browser.enabled](/config/browser/enabled)

Run tests in the browser. Equivalent to `--browser.enabled` (default: `false`)

### browser.name

- **CLI:** `--browser.name <name>`

Run all tests in a specific browser. Some browsers are only available for specific providers (see `--browser.provider`).

### browser.headless

- **CLI:** `--browser.headless`
- **Config:** [browser.headless](/config/browser/headless)

Run the browser in headless mode (i.e. without opening the GUI (Graphical User Interface)). If you are running Vitest in CI, it will be enabled by default (default: `process.env.CI`)

### browser.api.port

- **CLI:** `--browser.api.port [port]`
- **Config:** [browser.api.port](/config/browser/api#api-port)

Specify server port. Note if the port is already being used, Vite will automatically try the next available port so this may not be the actual port the server ends up listening on. If true will be set to `63315`

### browser.api.host

- **CLI:** `--browser.api.host [host]`
- **Config:** [browser.api.host](/config/browser/api#api-host)

Specify which IP addresses the server should listen on. Set this to `0.0.0.0` or `true` to listen on all addresses, including LAN and public addresses

### browser.api.strictPort

- **CLI:** `--browser.api.strictPort`
- **Config:** [browser.api.strictPort](/config/browser/api#api-strictport)

Set to true to exit if port is already in use, instead of automatically trying the next available port

### browser.api.allowExec

- **CLI:** `--browser.api.allowExec`
- **Config:** [browser.api.allowExec](/config/browser/api#api-allowexec)

Allow API to execute code. (Be careful when enabling this option in untrusted environments)

### browser.api.allowWrite

- **CLI:** `--browser.api.allowWrite`
- **Config:** [browser.api.allowWrite](/config/browser/api#api-allowwrite)

Allow API to edit files. (Be careful when enabling this option in untrusted environments)

### browser.isolate

- **CLI:** `--browser.isolate`
- **Config:** [browser.isolate](/config/browser/isolate)

Run every browser test file in isolation. To disable isolation, use `--browser.isolate=false` (default: `true`)

### browser.ui

- **CLI:** `--browser.ui`
- **Config:** [browser.ui](/config/browser/ui)

Show Vitest UI when running tests (default: `!process.env.CI`)

### browser.detailsPanelPosition

- **CLI:** `--browser.detailsPanelPosition <position>`
- **Config:** [browser.detailsPanelPosition](/config/browser/detailspanelposition)

Default position for the details panel in browser mode. Either `right` (horizontal split) or `bottom` (vertical split) (default: `right`)

### browser.fileParallelism

- **CLI:** `--browser.fileParallelism`

Should browser test files run in parallel. Use `--browser.fileParallelism=false` to disable (default: `true`)

### browser.connectTimeout

- **CLI:** `--browser.connectTimeout <timeout>`
- **Config:** [browser.connectTimeout](/config/browser/connecttimeout)

If connection to the browser takes longer, the test suite will fail (default: `60_000`)

### browser.trackUnhandledErrors

- **CLI:** `--browser.trackUnhandledErrors`
- **Config:** [browser.trackUnhandledErrors](/config/browser/trackunhandlederrors)

Control if Vitest catches uncaught exceptions so they can be reported (default: `true`)

### browser.trace

- **CLI:** `--browser.trace <mode>`
- **Config:** [browser.trace](/config/browser/trace)

Enable trace view mode. Supported: "on", "off", "on-first-retry", "on-all-retries", "retain-on-failure".

### pool

- **CLI:** `--pool <pool>`
- **Config:** [pool](/config/pool)

Specify pool, if not running in the browser (default: `forks`)

### execArgv

- **CLI:** `--execArgv <option>`
- **Config:** [execArgv](/config/execargv)

Pass additional arguments to `node` process when spawning `worker_threads` or `child_process`.

### vmMemoryLimit

- **CLI:** `--vmMemoryLimit <limit>`
- **Config:** [vmMemoryLimit](/config/vmmemorylimit)

Memory limit for VM pools. If you see memory leaks, try to tinker this value.

### fileParallelism

- **CLI:** `--fileParallelism`
- **Config:** [fileParallelism](/config/fileparallelism)

Should all test files run in parallel. Use `--no-file-parallelism` to disable (default: `true`)

### maxWorkers

- **CLI:** `--maxWorkers <workers>`
- **Config:** [maxWorkers](/config/maxworkers)

Maximum number or percentage of workers to run tests in

### environment

- **CLI:** `--environment <name>`
- **Config:** [environment](/config/environment)

Specify runner environment, if not running in the browser (default: `node`)

### passWithNoTests

- **CLI:** `--passWithNoTests`
- **Config:** [passWithNoTests](/config/passwithnotests)

Pass when no tests are found

### logHeapUsage

- **CLI:** `--logHeapUsage`
- **Config:** [logHeapUsage](/config/logheapusage)

Show the size of heap for each test when running in node

### detectAsyncLeaks

- **CLI:** `--detectAsyncLeaks`
- **Config:** [detectAsyncLeaks](/config/detectasyncleaks)

Detect asynchronous resources leaking from the test file (default: `false`)

### allowOnly

- **CLI:** `--allowOnly`
- **Config:** [allowOnly](/config/allowonly)

Allow tests and suites that are marked as only (default: `!process.env.CI`)

### dangerouslyIgnoreUnhandledErrors

- **CLI:** `--dangerouslyIgnoreUnhandledErrors`
- **Config:** [dangerouslyIgnoreUnhandledErrors](/config/dangerouslyignoreunhandlederrors)

Ignore any unhandled errors that occur

### sequence.shuffle.files

- **CLI:** `--sequence.shuffle.files`
- **Config:** [sequence.shuffle.files](/config/sequence#sequence-shuffle-files)

Run files in a random order. Long running tests will not start earlier if you enable this option. (default: `false`)

### sequence.shuffle.tests

- **CLI:** `--sequence.shuffle.tests`
- **Config:** [sequence.shuffle.tests](/config/sequence#sequence-shuffle-tests)

Run tests in a random order (default: `false`)

### sequence.concurrent

- **CLI:** `--sequence.concurrent`
- **Config:** [sequence.concurrent](/config/sequence#sequence-concurrent)

Make tests run in parallel (default: `false`)

### sequence.seed

- **CLI:** `--sequence.seed <seed>`
- **Config:** [sequence.seed](/config/sequence#sequence-seed)

Set the randomization seed. This option will have no effect if `--sequence.shuffle` is falsy. Visit ["Random Seed" page](https://en.wikipedia.org/wiki/Random_seed) for more information

### sequence.hooks

- **CLI:** `--sequence.hooks <order>`
- **Config:** [sequence.hooks](/config/sequence#sequence-hooks)

Changes the order in which hooks are executed. Accepted values are: "stack", "list" and "parallel". Visit [`sequence.hooks`](/config/sequence#sequence-hooks) for more information (default: `"parallel"`)

### sequence.setupFiles

- **CLI:** `--sequence.setupFiles <order>`
- **Config:** [sequence.setupFiles](/config/sequence#sequence-setupfiles)

Changes the order in which setup files are executed. Accepted values are: "list" and "parallel". If set to "list", will run setup files in the order they are defined. If set to "parallel", will run setup files in parallel (default: `"parallel"`)

### inspect

- **CLI:** `--inspect [[host:]port]`

Enable Node.js inspector (default: `127.0.0.1:9229`)

### inspectBrk

- **CLI:** `--inspectBrk [[host:]port]`

Enable Node.js inspector and break before the test starts

### testTimeout

- **CLI:** `--testTimeout <timeout>`
- **Config:** [testTimeout](/config/testtimeout)

Default timeout of a test in milliseconds (default: `5000`). Use `0` to disable timeout completely.

### hookTimeout

- **CLI:** `--hookTimeout <timeout>`
- **Config:** [hookTimeout](/config/hooktimeout)

Default hook timeout in milliseconds (default: `10000`). Use `0` to disable timeout completely.

### bail

- **CLI:** `--bail <number>`
- **Config:** [bail](/config/bail)

Stop test execution when given number of tests have failed (default: `0`)

### retry.count

- **CLI:** `--retry.count <times>`
- **Config:** [retry.count](/config/retry#retry-count)

Number of times to retry a test if it fails (default: `0`)

### retry.delay

- **CLI:** `--retry.delay <ms>`
- **Config:** [retry.delay](/config/retry#retry-delay)

Delay in milliseconds between retry attempts (default: `0`)

### retry.condition

- **CLI:** `--retry.condition <pattern>`
- **Config:** [retry.condition](/config/retry#retry-condition)

Regex pattern to match error messages that should trigger a retry. Only errors matching this pattern will cause a retry (default: retry on all errors)

### diff.aAnnotation

- **CLI:** `--diff.aAnnotation <annotation>`
- **Config:** [diff.aAnnotation](/config/diff#diff-aannotation)

Annotation for expected lines (default: `Expected`)

### diff.aIndicator

- **CLI:** `--diff.aIndicator <indicator>`
- **Config:** [diff.aIndicator](/config/diff#diff-aindicator)

Indicator for expected lines (default: `-`)

### diff.bAnnotation

- **CLI:** `--diff.bAnnotation <annotation>`
- **Config:** [diff.bAnnotation](/config/diff#diff-bannotation)

Annotation for received lines (default: `Received`)

### diff.bIndicator

- **CLI:** `--diff.bIndicator <indicator>`
- **Config:** [diff.bIndicator](/config/diff#diff-bindicator)

Indicator for received lines (default: `+`)

### diff.commonIndicator

- **CLI:** `--diff.commonIndicator <indicator>`
- **Config:** [diff.commonIndicator](/config/diff#diff-commonindicator)

Indicator for common lines (default: ` `)

### diff.contextLines

- **CLI:** `--diff.contextLines <lines>`
- **Config:** [diff.contextLines](/config/diff#diff-contextlines)

Number of lines of context to show around each change (default: `5`)

### diff.emptyFirstOrLastLinePlaceholder

- **CLI:** `--diff.emptyFirstOrLastLinePlaceholder <placeholder>`
- **Config:** [diff.emptyFirstOrLastLinePlaceholder](/config/diff#diff-emptyfirstorlastlineplaceholder)

Placeholder for an empty first or last line (default: `""`)

### diff.expand

- **CLI:** `--diff.expand`
- **Config:** [diff.expand](/config/diff#diff-expand)

Expand all common lines (default: `true`)

### diff.includeChangeCounts

- **CLI:** `--diff.includeChangeCounts`
- **Config:** [diff.includeChangeCounts](/config/diff#diff-includechangecounts)

Include comparison counts in diff output (default: `false`)

### diff.omitAnnotationLines

- **CLI:** `--diff.omitAnnotationLines`
- **Config:** [diff.omitAnnotationLines](/config/diff#diff-omitannotationlines)

Omit annotation lines from the output (default: `false`)

### diff.printBasicPrototype

- **CLI:** `--diff.printBasicPrototype`
- **Config:** [diff.printBasicPrototype](/config/diff#diff-printbasicprototype)

Print basic prototype Object and Array (default: `true`)

### diff.maxDepth

- **CLI:** `--diff.maxDepth <maxDepth>`
- **Config:** [diff.maxDepth](/config/diff#diff-maxdepth)

Limit the depth to recurse when printing nested objects (default: `20`)

### diff.truncateThreshold

- **CLI:** `--diff.truncateThreshold <threshold>`
- **Config:** [diff.truncateThreshold](/config/diff#diff-truncatethreshold)

Number of lines to show before and after each change (default: `0`)

### diff.truncateAnnotation

- **CLI:** `--diff.truncateAnnotation <annotation>`
- **Config:** [diff.truncateAnnotation](/config/diff#diff-truncateannotation)

Annotation for truncated lines (default: `... Diff result is truncated`)

### exclude

- **CLI:** `--exclude <glob>`
- **Config:** [exclude](/config/exclude)

Additional file globs to be excluded from test

### expandSnapshotDiff

- **CLI:** `--expandSnapshotDiff`
- **Config:** [expandSnapshotDiff](/config/expandsnapshotdiff)

Show full diff when snapshot fails

### disableConsoleIntercept

- **CLI:** `--disableConsoleIntercept`
- **Config:** [disableConsoleIntercept](/config/disableconsoleintercept)

Disable automatic interception of console logging (default: `false`)

### typecheck.enabled

- **CLI:** `--typecheck.enabled`
- **Config:** [typecheck.enabled](/config/typecheck#typecheck-enabled)

Enable typechecking alongside tests (default: `false`)

### typecheck.only

- **CLI:** `--typecheck.only`
- **Config:** [typecheck.only](/config/typecheck#typecheck-only)

Run only typecheck tests. This automatically enables typecheck (default: `false`)

### typecheck.checker

- **CLI:** `--typecheck.checker <name>`
- **Config:** [typecheck.checker](/config/typecheck#typecheck-checker)

Specify the typechecker to use. Available values are: "tsc" and "vue-tsc" and a path to an executable (default: `"tsc"`)

### typecheck.allowJs

- **CLI:** `--typecheck.allowJs`
- **Config:** [typecheck.allowJs](/config/typecheck#typecheck-allowjs)

Allow JavaScript files to be typechecked. By default takes the value from tsconfig.json

### typecheck.ignoreSourceErrors

- **CLI:** `--typecheck.ignoreSourceErrors`
- **Config:** [typecheck.ignoreSourceErrors](/config/typecheck#typecheck-ignoresourceerrors)

Ignore type errors from source files

### typecheck.tsconfig

- **CLI:** `--typecheck.tsconfig <path>`
- **Config:** [typecheck.tsconfig](/config/typecheck#typecheck-tsconfig)

Path to a custom tsconfig file

### typecheck.spawnTimeout

- **CLI:** `--typecheck.spawnTimeout <time>`
- **Config:** [typecheck.spawnTimeout](/config/typecheck#typecheck-spawntimeout)

Minimum time in milliseconds it takes to spawn the typechecker

### project

- **CLI:** `--project <name>`

The name of the project to run if you are using Vitest workspace feature. This can be repeated for multiple projects: `--project=1 --project=2`. You can also filter projects using wildcards like `--project=packages*`, and exclude projects with `--project=!pattern`.

### slowTestThreshold

- **CLI:** `--slowTestThreshold <threshold>`
- **Config:** [slowTestThreshold](/config/slowtestthreshold)

Threshold in milliseconds for a test or suite to be considered slow (default: `300`)

### teardownTimeout

- **CLI:** `--teardownTimeout <timeout>`
- **Config:** [teardownTimeout](/config/teardowntimeout)

Default timeout of a teardown function in milliseconds (default: `10000`)

### maxConcurrency

- **CLI:** `--maxConcurrency <number>`
- **Config:** [maxConcurrency](/config/maxconcurrency)

Maximum number of concurrent tests and suites during test file execution (default: `5`)

### expect.requireAssertions

- **CLI:** `--expect.requireAssertions`
- **Config:** [expect.requireAssertions](/config/expect#expect-requireassertions)

Require that all tests have at least one assertion

### expect.poll.interval

- **CLI:** `--expect.poll.interval <interval>`
- **Config:** [expect.poll.interval](/config/expect#expect-poll-interval)

Poll interval in milliseconds for `expect.poll()` assertions (default: `50`)

### expect.poll.timeout

- **CLI:** `--expect.poll.timeout <timeout>`
- **Config:** [expect.poll.timeout](/config/expect#expect-poll-timeout)

Poll timeout in milliseconds for `expect.poll()` assertions (default: `1000`)

### printConsoleTrace

- **CLI:** `--printConsoleTrace`
- **Config:** [printConsoleTrace](/config/printconsoletrace)

Always print console stack traces

### includeTaskLocation

- **CLI:** `--includeTaskLocation`
- **Config:** [includeTaskLocation](/config/includetasklocation)

Collect test and suite locations in the `location` property

### attachmentsDir

- **CLI:** `--attachmentsDir <dir>`
- **Config:** [attachmentsDir](/config/attachmentsdir)

The directory where attachments from `context.annotate` are stored in (default: `.vitest-attachments`)

### run

- **CLI:** `--run`

Disable watch mode

### color

- **CLI:** `--no-color`

Removes colors from the console output

### clearScreen

- **CLI:** `--clearScreen`

Clear terminal screen when re-running tests during watch mode (default: `true`)

### configLoader

- **CLI:** `--configLoader <loader>`

Use `bundle` to bundle the config with esbuild or `runner` (experimental) to process it on the fly. This is only available in vite version 6.1.0 and above. (default: `bundle`)

### standalone

- **CLI:** `--standalone`

Start Vitest without running tests. Tests will be running only on change. This option is ignored when CLI file filters are passed. (default: `false`)

### listTags

- **CLI:** `--listTags [type]`

List all available tags instead of running tests. `--list-tags=json` will output tags in JSON format, unless there are no tags.

### clearCache

- **CLI:** `--clearCache`

Delete all Vitest caches, including `experimental.fsModuleCache`, without running any tests. This will reduce the performance in the subsequent test run.

### tagsFilter

- **CLI:** `--tagsFilter <expression>`

Run only tests with the specified tags. You can use logical operators `&&` (and), `||` (or) and `!` (not) to create complex expressions, see [Test Tags](/guide/test-tags#syntax) for more information.

### strictTags

- **CLI:** `--strictTags`
- **Config:** [strictTags](/config/stricttags)

Should Vitest throw an error if test has a tag that is not defined in the config. (default: `true`)

### experimental.fsModuleCache

- **CLI:** `--experimental.fsModuleCache`
- **Config:** [experimental.fsModuleCache](/config/experimental#experimental-fsmodulecache)

Enable caching of modules on the file system between reruns.

### experimental.importDurations.print

- **CLI:** `--experimental.importDurations.print <boolean|on-warn>`
- **Config:** [experimental.importDurations.print](/config/experimental#experimental-importdurations-print)

When to print import breakdown to CLI terminal. Use `true` to always print, `false` to never print, or `on-warn` to print only when imports exceed the warn threshold (default: false).

### experimental.importDurations.limit

- **CLI:** `--experimental.importDurations.limit <number>`
- **Config:** [experimental.importDurations.limit](/config/experimental#experimental-importdurations-limit)

Maximum number of imports to collect and display (default: 0, or 10 if print or UI is enabled).

### experimental.importDurations.failOnDanger

- **CLI:** `--experimental.importDurations.failOnDanger`
- **Config:** [experimental.importDurations.failOnDanger](/config/experimental#experimental-importdurations-failondanger)

Fail the test run if any import exceeds the danger threshold (default: false).

### experimental.importDurations.thresholds.warn

- **CLI:** `--experimental.importDurations.thresholds.warn <number>`
- **Config:** [experimental.importDurations.thresholds.warn](/config/experimental#experimental-importdurations-thresholds-warn)

Warning threshold - imports exceeding this are shown in yellow/orange (default: 100).

### experimental.importDurations.thresholds.danger

- **CLI:** `--experimental.importDurations.thresholds.danger <number>`
- **Config:** [experimental.importDurations.thresholds.danger](/config/experimental#experimental-importdurations-thresholds-danger)

Danger threshold - imports exceeding this are shown in red (default: 500).

### experimental.viteModuleRunner

- **CLI:** `--experimental.viteModuleRunner`
- **Config:** [experimental.viteModuleRunner](/config/experimental#experimental-vitemodulerunner)

Control whether Vitest uses Vite's module runner to run the code or fallback to the native `import`. (default: `true`)

### experimental.nodeLoader

- **CLI:** `--experimental.nodeLoader`
- **Config:** [experimental.nodeLoader](/config/experimental#experimental-nodeloader)

Controls whether Vitest will use Node.js Loader API to process in-source or mocked files. This has no effect if `viteModuleRunner` is enabled. Disabling this can increase performance. (default: `true`)
