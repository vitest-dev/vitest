import { normalize } from 'pathe'
import cac from 'cac'
import c from 'picocolors'
import { version } from '../../package.json'
import { toArray } from '../utils'
import type { BaseCoverageOptions, CoverageIstanbulOptions, Vitest, VitestRunMode } from '../types'
import { defaultBrowserPort, defaultPort } from '../constants'
import type { CliOptions } from './cli-api'
import { startVitest } from './cli-api'
import { divider } from './reporters/renderers/utils'

const cli = cac('vitest')

cli
  .version(version)
  .option('-r, --root <path>', 'Root path')
  .option('-c, --config <path>', 'Path to config file')
  .option('-u, --update', 'Update snapshot')
  .option('-w, --watch', 'Enable watch mode')
  .option('-t, --testNamePattern <pattern>', 'Run tests with full names matching the specified regexp pattern')
  .option('--dir <path>', 'Base directory to scan for the test files')
  .option('--ui', 'Enable UI')
  .option('--open', 'Open UI automatically (default: !process.env.CI))')
  .option('--api [port]', `Specify server port. Note if the port is already being used, Vite will automatically try the next available port so this may not be the actual port the server ends up listening on. If true will be set to ${defaultPort}`)
  .option('--api.port <port>', 'Specify server port. Note if the port is already being used, Vite will automatically try the next available port so this may not be the actual port the server ends up listening on')
  .option('--api.host [host]', 'Specify which IP addresses the server should listen on. Set this to 0.0.0.0 or true to listen on all addresses, including LAN and public addresses')
  .option('--api.strictPort', 'Set to true to exit if port is already in use, instead of automatically trying the next available port')
  .option('--silent', 'Silent console output from tests')
  .option('--hideSkippedTests', 'Hide logs for skipped tests')
  .option('--reporter <name>', 'Specify reporters')
  .option('--outputFile <filename/-s>', 'Write test results to a file when supporter reporter is also specified, use cac\'s dot notation for individual outputs of multiple reporters')
  .option('--coverage', 'Enable coverage report')
  .option('--coverage.all', 'Whether to include all files, including the untested ones into report', { default: true })
  .option('--coverage.provider', 'Select the tool for coverage collection, available values are: "v8", "istanbul" and "custom"')
  .option('--coverage.enabled', 'Enables coverage collection. Can be overridden using the --coverage CLI option. This option is not available for custom providers (default: false)')
  .option('--coverage.include', 'Files included in coverage as glob patterns. May be specified more than once when using multiple patterns. This option is not available for custom providers (default: **)')
  .option('--coverage.extension', 'Extension to be included in coverage. May be specified more than once when using multiple extensions. This option is not available for custom providers (default: [".js", ".cjs", ".mjs", ".ts", ".mts", ".cts", ".tsx", ".jsx", ".vue", ".svelte"])')
  .option('--coverage.exclude', 'Files to be excluded in coverage. May be specified more than once when using multiple extensions. This option is not available for custom providers (default: Visit https://vitest.dev/config/#coverage-exclude)')
  .option('--coverage.all', 'Whether to include all files, including the untested ones into report. This option is not available for custom providers (default: false)')
  .option('--coverage.clean', 'Clean coverage results before running tests. This option is not available for custom providers (default: true)')
  .option('--coverage.cleanOnRerun', 'Clean coverage report on watch rerun. This option is not available for custom providers (default: true)')
  .option('--coverage.reportsDirectory', 'Directory to write coverage report to. This option is not available for custom providers (default: ./coverage)')
  .option('--coverage.reporter', 'Coverage reporters to use. Visit https://vitest.dev/config/#coverage-reporter for more information. This option is not available for custom providers (default: ["text", "html", "clover", "json"])')
  .option('--coverage.reportOnFailure', 'Generate coverage report even when tests fail. This option is not available for custom providers (default: false)')
  .option('--coverage.allowExternal', 'Collect coverage of files outside the project root. This option is not available for custom providers (default: false)')
  .option('--coverage.skipFull', 'Do not show files with 100% statement, branch, and function coverage. This option is not available for custom providers (default: false)')
  .option('--coverage.perFile', 'Check thresholds per file. See --coverage.lines, --coverage.functions, --coverage.branches and --coverage.statements for the actual thresholds. This option is not available for custom providers (default: false)')
  .option('--coverage.thresholdAutoUpdate', 'Update threshold values: "lines", "functions", "branches" and "statements" to configuration file when current coverage is above the configured thresholds. This option is not available for custom providers (default: false)')
  .option('--coverage.lines', 'Threshold for lines. Visit https://github.com/istanbuljs/nyc#coverage-thresholds for more information. This option is not available for custom providers')
  .option('--coverage.functions', 'Threshold for functions. Visit https://github.com/istanbuljs/nyc#coverage-thresholds for more information. This option is not available for custom providers')
  .option('--coverage.branches', 'Threshold for branches. Visit https://github.com/istanbuljs/nyc#coverage-thresholds for more information. This option is not available for custom providers')
  .option('--coverage.statements', 'Threshold for statements. Visit https://github.com/istanbuljs/nyc#coverage-thresholds for more information. This option is not available for custom providers')
  .option('--coverage.100', 'Shortcut to set all coverage thresholds to 100. This option is only available for the v8 provider (default: false)')
  .option('--coverage.ignoreClassMethods', 'Array of class method names to ignore for coverage. Visit https://github.com/istanbuljs/nyc#ignoring-methods for more information. This option is only available for the istanbul providers (default: [])')
  .option('--coverage.watermarks', 'Watermarks for statements, lines, branches and functions. Visit https://github.com/istanbuljs/nyc#high-and-low-watermarks for more information. This option is not available for custom providers (default: Visit https://vitest.dev/config/#coverage-watermarks)')
  .option('--coverage.customProviderModule', 'Specifies the module name or path for the custom coverage provider module. Visit https://vitest.dev/guide/coverage.html#custom-coverage-provider for more information. This option is only available for custom providers')
  .option('--run', 'Disable watch mode')
  .option('--mode <name>', 'Override Vite mode (default: test)')
  .option('--workspace <path>', 'Path to a workspace configuration file')
  .option('--isolate', 'Run every test file in isolation. To disable isolation, use --no-isolate (default: true)')
  .option('--globals', 'Inject apis globally')
  .option('--dom', 'Mock browser API with happy-dom')
  .option('--browser', 'Run tests in the browser. Equivalent to --browser.enabled (default: false)')
  .option('--browser.enabled', 'Run all tests inside a browser by default. Can be overriden with the poolMatchGlobs configuration file option (default: false)')
  .option('--browser.name', 'Run all tests in a specific browser. Some browsers are only available for specific providers (see --browser.provider). Visit https://vitest.dev/config/#browser-name for more information')
  .option('--browser.headless', 'Run the browser in headless mode (i.e. without opening the GUI (Graphical User Interface)). If you are running Vitest in CI, it will be enabled by default (default: process.env.CI)')
  .option('--browser.api [port]', `Specify server port. Note if the port is already being used, Vite will automatically try the next available port so this may not be the actual port the server ends up listening on. Does not affect the --api option. If true will be set to ${defaultBrowserPort} (default: ${defaultBrowserPort})`)
  .option('--browser.api.port <port>', 'Specify server port. Note if the port is already being used, Vite will automatically try the next available port so this may not be the actual port the server ends up listening on. Does not affect the --api.port option')
  .option('--browser.api.host [host]', 'Specify which IP addresses the server should listen on. Set this to 0.0.0.0 or true to listen on all addresses, including LAN and public addresses. Does not affect the --api.host option')
  .option('--browser.provider', 'Provider used to run browser tests. Some browsers are only available for specific providers. Can be "webdriverio", "playwright", or the path to a custom provider. Visit https://vitest.dev/config/#browser-provider for more information (default: "webdriverio")')
  .option('--browser.slowHijackESM', 'Let Vitest use its own module resolution on the browser to enable APIs such as vi.mock and vi.spyOn. Visit https://vitest.dev/config/#browser-slowhijackesm for more information (default: true)')
  .option('--pool <pool>', 'Specify pool, if not running in the browser (default: threads)')
  .option('--poolOptions <options>', 'Specify pool options')
  .option('--poolOptions.threads.isolate', 'Isolate tests in threads pool (default: true)')
  .option('--poolOptions.forks.isolate', 'Isolate tests in forks pool (default: true)')
  .option('--fileParallelism', 'Should all test files run in parallel. Use --no-file-parallelism to disable (default: true)')
  .option('--maxWorkers <workers>', 'Maximum number of workers to run tests in')
  .option('--minWorkers <workers>', 'Minimum number of workers to run tests in')
  .option('--environment <env>', 'Specify runner environment, if not running in the browser (default: node)')
  .option('--passWithNoTests', 'Pass when no tests found')
  .option('--logHeapUsage', 'Show the size of heap for each test')
  .option('--allowOnly', 'Allow tests and suites that are marked as only (default: !process.env.CI)')
  .option('--dangerouslyIgnoreUnhandledErrors', 'Ignore any unhandled errors that occur')
  .option('--shard <shard>', 'Test suite shard to execute in a format of <index>/<count>')
  .option('--changed [since]', 'Run tests that are affected by the changed files (default: false)')
  .option('--sequence.shuffle [shuffle]', 'Run tests in a random order. Enabling this option will impact Vitest\'s cache and have a performance impact. May be useful to find tests that accidentally depend on another run previously (default: false)')
  .option('--sequence.concurrent [concurrent]', 'Make tests run in parallel (default: false)')
  .option('--sequence.seed <seed>', 'Set the randomization seed. This option will have no effect if --sequence.shuffle is falsy. Visit https://en.wikipedia.org/wiki/Random_seed for more information')
  .option('--sequence.hooks <order>', 'Changes the order in which hooks are executed. Accepted values are: "stack", "list" and "parallel". Visit https://vitest.dev/config/#sequence-hooks for more information (default: "parallel")')
  .option('--sequence.setupFiles <order>', 'Changes the order in which setup files are executed. Accepted values are: "list" and "parallel". If set to "list", will run setup files in the order they are defined. If set to "parallel", will run setup files in parallel (default: "parallel")')
  .option('--segfaultRetry <times>', 'Return tests on segment fault (default: 0)', { default: 0 })
  .option('--no-color', 'Removes colors from the console output')
  .option('--inspect', 'Enable Node.js inspector')
  .option('--inspect-brk', 'Enable Node.js inspector with break')
  .option('--test-timeout <time>', 'Default timeout of a test in milliseconds (default: 5000)')
  .option('--bail <number>', 'Stop test execution when given number of tests have failed (default: 0)')
  .option('--retry <times>', 'Retry the test specific number of times if it fails (default: 0)')
  .option('--diff <path>', 'Path to a diff config that will be used to generate diff interface')
  .option('--exclude <glob>', 'Additional file globs to be excluded from test')
  .option('--expand-snapshot-diff', 'Show full diff when snapshot fails')
  .option('--disable-console-intercept', 'Disable automatic interception of console logging (default: `false`)')
  .option('--typecheck [options]', 'Custom options for typecheck pool')
  .option('--typecheck.enabled', 'Enable typechecking alongside tests (default: false)')
  .option('--typecheck.only', 'Run only typecheck tests. This automatically enables typecheck (default: false)')
  .option('--project <name>', 'The name of the project to run if you are using Vitest workspace feature. This can be repeated for multiple projects: --project=1 --project=2')
  .help((info) => {
    if (process.env.VERBOSE === 'true')
      return info

    const optionObj = info.find(current => current.title === 'Options')
    if (typeof optionObj !== 'object')
      return info

    const options = optionObj.body.split('\n')
    const filteredOptions = options.filter(option => option.search(/\S+\.\S+/) === -1).join('\n')
    optionObj.body = filteredOptions

    return info
  })

cli
  .command('run [...filters]')
  .action(run)

cli
  .command('related [...filters]')
  .action(runRelated)

cli
  .command('watch [...filters]')
  .action(watch)

cli
  .command('dev [...filters]')
  .action(watch)

cli
  .command('bench [...filters]')
  .action(benchmark)

// TODO: remove in Vitest 2.0
cli
  .command('typecheck [...filters]')
  .action(() => {
    throw new Error(`Running typecheck via "typecheck" command is removed. Please use "--typecheck" to run your regular tests alongside typechecking, or "--typecheck.only" to run only typecheck tests.`)
  })

cli
  .command('[...filters]')
  .action((filters, options) => start('test', filters, options))

try {
  cli.parse()
}
catch (originalError) {
  // CAC may fail to parse arguments when boolean flags and dot notation are mixed
  // e.g. "--coverage --coverage.reporter text" will fail, when "--coverage.enabled --coverage.reporter text" will pass
  const fullArguments = cli.rawArgs.join(' ')
  const conflictingArgs: { arg: string; dotArgs: string[] }[] = []

  for (const arg of cli.rawArgs) {
    if (arg.startsWith('--') && !arg.includes('.') && fullArguments.includes(`${arg}.`)) {
      const dotArgs = cli.rawArgs.filter(rawArg => rawArg.startsWith(arg) && rawArg.includes('.'))
      conflictingArgs.push({ arg, dotArgs })
    }
  }

  if (conflictingArgs.length === 0)
    throw originalError

  const error = conflictingArgs
    .map(({ arg, dotArgs }) =>
      `A boolean argument "${arg}" was used with dot notation arguments "${dotArgs.join(' ')}".`
      + `\nPlease specify the "${arg}" argument with dot notation as well: "${arg}.enabled"`)
    .join('\n')

  throw new Error(error)
}

async function runRelated(relatedFiles: string[] | string, argv: CliOptions): Promise<void> {
  argv.related = relatedFiles
  argv.passWithNoTests ??= true
  await start('test', [], argv)
}

async function watch(cliFilters: string[], options: CliOptions): Promise<void> {
  options.watch = true
  await start('test', cliFilters, options)
}

async function run(cliFilters: string[], options: CliOptions): Promise<void> {
  options.run = true
  await start('test', cliFilters, options)
}

async function benchmark(cliFilters: string[], options: CliOptions): Promise<void> {
  console.warn(c.yellow('Benchmarking is an experimental feature.\nBreaking changes might not follow SemVer, please pin Vitest\'s version when using it.'))
  await start('benchmark', cliFilters, options)
}

function normalizeCliOptions(argv: CliOptions): CliOptions {
  if (argv.root)
    argv.root = normalize(argv.root)
  else
    delete argv.root

  if (argv.config)
    argv.config = normalize(argv.config)
  else
    delete argv.config

  if (argv.workspace)
    argv.workspace = normalize(argv.workspace)
  else
    delete argv.workspace

  if (argv.dir)
    argv.dir = normalize(argv.dir)
  else
    delete argv.dir

  if (argv.exclude) {
    argv.cliExclude = toArray(argv.exclude)
    delete argv.exclude
  }

  if (argv.coverage) {
    const coverage = argv.coverage
    if (coverage.exclude)
      coverage.exclude = toArray(coverage.exclude)

    if ((coverage as BaseCoverageOptions).include)
      (coverage as BaseCoverageOptions).include = toArray((coverage as BaseCoverageOptions).include)

    if ((coverage as CoverageIstanbulOptions).ignoreClassMethods)
      (coverage as CoverageIstanbulOptions).ignoreClassMethods = toArray((coverage as CoverageIstanbulOptions).ignoreClassMethods)
  }
  return argv
}

async function start(mode: VitestRunMode, cliFilters: string[], options: CliOptions): Promise<Vitest | undefined> {
  try {
    process.title = 'node (vitest)'
  }
  catch {}

  try {
    const ctx = await startVitest(mode, cliFilters.map(normalize), normalizeCliOptions(options))
    if (!ctx?.shouldKeepServer())
      await ctx?.exit()
    return ctx
  }
  catch (e) {
    console.error(`\n${c.red(divider(c.bold(c.inverse(' Unhandled Error '))))}`)
    console.error(e)
    console.error('\n\n')
    process.exit(1)
  }
}
