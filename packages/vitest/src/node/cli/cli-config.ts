import type { ApiConfig } from '../types/config'
import type {
  ForksOptions,
  ThreadsOptions,
  VmOptions,
  WorkerContextOptions,
} from '../types/pool-options'
import type { CliOptions } from './cli-api'
import { defaultBrowserPort, defaultPort } from '../../constants'

type NestedOption<T, V = Extract<T, Record<string, any>>> = V extends
  | never
  | RegExp
  | unknown[]
  ? never
  : V

export type CLIOption<Value> = {
  description: string | null
  alias?: string
  shorthand?: string
  default?: unknown
  transform?: (value: unknown) => unknown
  array?: boolean
  normalize?: boolean
} & (NestedOption<Value> extends never // require subcommands for nested options
  ? object
  : { subcommands: CLIOptions<NestedOption<Value>> | null }) &
  // require argument for non-boolean options
  (NonNullable<Value> extends boolean ? object : { argument: string })

export type CLIOptions<Config extends object> = {
  [Key in keyof Config as NonNullable<Config[Key]> extends Function
    ? never
    : Key]-?: CLIOption<Config[Key]> | null;
}

type VitestCLIOptions = CLIOptions<CliOptions>

const apiConfig: (port: number) => CLIOptions<ApiConfig> = (port: number) => ({
  port: {
    description: `Specify server port. Note if the port is already being used, Vite will automatically try the next available port so this may not be the actual port the server ends up listening on. If true will be set to \`${port}\``,
    argument: '[port]',
  },
  host: {
    description:
      'Specify which IP addresses the server should listen on. Set this to `0.0.0.0` or `true` to listen on all addresses, including LAN and public addresses',
    argument: '[host]',
  },
  strictPort: {
    description:
      'Set to true to exit if port is already in use, instead of automatically trying the next available port',
  },
  middlewareMode: null,
})

const poolThreadsCommands: CLIOptions<ThreadsOptions & WorkerContextOptions> = {
  isolate: {
    description: 'Isolate tests in threads pool (default: `true`)',
  },
  singleThread: {
    description: 'Run tests inside a single thread (default: `false`)',
  },
  maxThreads: {
    description: 'Maximum number or percentage of threads to run tests in',
    argument: '<workers>',
  },
  minThreads: {
    description: 'Minimum number or percentage of threads to run tests in',
    argument: '<workers>',
  },
  useAtomics: {
    description:
      'Use Atomics to synchronize threads. This can improve performance in some cases, but might cause segfault in older Node versions (default: `false`)',
  },
  execArgv: null,
}

const poolForksCommands: CLIOptions<ForksOptions & WorkerContextOptions> = {
  isolate: {
    description: 'Isolate tests in forks pool (default: `true`)',
  },
  singleFork: {
    description: 'Run tests inside a single child_process (default: `false`)',
  },
  maxForks: {
    description: 'Maximum number or percentage of processes to run tests in',
    argument: '<workers>',
  },
  minForks: {
    description: 'Minimum number or percentage of processes to run tests in',
    argument: '<workers>',
  },
  execArgv: null,
}

function watermarkTransform(value: unknown) {
  if (typeof value === 'string') {
    return value.split(',').map(Number)
  }
  return value
}

function transformNestedBoolean(value: unknown) {
  if (typeof value === 'boolean') {
    return { enabled: value }
  }
  return value
}

export const cliOptionsConfig: VitestCLIOptions = {
  root: {
    description: 'Root path',
    shorthand: 'r',
    argument: '<path>',
    normalize: true,
  },
  config: {
    shorthand: 'c',
    description: 'Path to config file',
    argument: '<path>',
    normalize: true,
  },
  update: {
    shorthand: 'u',
    description: 'Update snapshot',
  },
  watch: {
    shorthand: 'w',
    description: 'Enable watch mode',
  },
  testNamePattern: {
    description:
      'Run tests with full names matching the specified regexp pattern',
    argument: '<pattern>',
    shorthand: 't',
  },
  dir: {
    description: 'Base directory to scan for the test files',
    argument: '<path>',
    normalize: true,
  },
  ui: {
    description: 'Enable UI',
  },
  open: {
    description: 'Open UI automatically (default: `!process.env.CI`)',
  },
  api: {
    argument: '[port]',
    description: `Specify server port. Note if the port is already being used, Vite will automatically try the next available port so this may not be the actual port the server ends up listening on. If true will be set to ${defaultPort}`,
    subcommands: apiConfig(defaultPort),
  },
  silent: {
    description: 'Silent console output from tests',
  },
  hideSkippedTests: {
    description: 'Hide logs for skipped tests',
  },
  reporters: {
    alias: 'reporter',
    description: 'Specify reporters',
    argument: '<name>',
    subcommands: null, // don't support custom objects
    array: true,
  },
  outputFile: {
    argument: '<filename/-s>',
    description:
      'Write test results to a file when supporter reporter is also specified, use cac\'s dot notation for individual outputs of multiple reporters (example: `--outputFile.tap=./tap.txt`)',
    subcommands: null,
  },
  coverage: {
    description: 'Enable coverage report',
    argument: '', // empty string means boolean
    transform: transformNestedBoolean,
    subcommands: {
      all: {
        description:
          'Whether to include all files, including the untested ones into report',
        default: true,
      },
      provider: {
        description:
          'Select the tool for coverage collection, available values are: "v8", "istanbul" and "custom"',
        argument: '<name>',
      },
      enabled: {
        description:
          'Enables coverage collection. Can be overridden using the `--coverage` CLI option (default: `false`)',
      },
      include: {
        description:
          'Files included in coverage as glob patterns. May be specified more than once when using multiple patterns (default: `**`)',
        argument: '<pattern>',
        array: true,
      },
      exclude: {
        description:
          'Files to be excluded in coverage. May be specified more than once when using multiple extensions (default: Visit [`coverage.exclude`](https://vitest.dev/config/#coverage-exclude))',
        argument: '<pattern>',
        array: true,
      },
      extension: {
        description:
          'Extension to be included in coverage. May be specified more than once when using multiple extensions (default: `[".js", ".cjs", ".mjs", ".ts", ".mts", ".tsx", ".jsx", ".vue", ".svelte"]`)',
        argument: '<extension>',
        array: true,
      },
      clean: {
        description:
          'Clean coverage results before running tests (default: true)',
      },
      cleanOnRerun: {
        description: 'Clean coverage report on watch rerun (default: true)',
      },
      reportsDirectory: {
        description:
          'Directory to write coverage report to (default: ./coverage)',
        argument: '<path>',
        normalize: true,
      },
      reporter: {
        description:
          'Coverage reporters to use. Visit [`coverage.reporter`](https://vitest.dev/config/#coverage-reporter) for more information (default: `["text", "html", "clover", "json"]`)',
        argument: '<name>',
        subcommands: null, // don't support custom objects
        array: true,
      },
      reportOnFailure: {
        description:
          'Generate coverage report even when tests fail (default: `false`)',
      },
      allowExternal: {
        description:
          'Collect coverage of files outside the project root (default: `false`)',
      },
      skipFull: {
        description:
          'Do not show files with 100% statement, branch, and function coverage (default: `false`)',
      },
      thresholds: {
        description: null,
        argument: '', // no displayed
        subcommands: {
          perFile: {
            description:
              'Check thresholds per file. See `--coverage.thresholds.lines`, `--coverage.thresholds.functions`, `--coverage.thresholds.branches` and `--coverage.thresholds.statements` for the actual thresholds (default: `false`)',
          },
          autoUpdate: {
            description:
              'Update threshold values: "lines", "functions", "branches" and "statements" to configuration file when current coverage is above the configured thresholds (default: `false`)',
          },
          lines: {
            description:
              'Threshold for lines. Visit [istanbuljs](https://github.com/istanbuljs/nyc#coverage-thresholds) for more information. This option is not available for custom providers',
            argument: '<number>',
          },
          functions: {
            description:
              'Threshold for functions. Visit [istanbuljs](https://github.com/istanbuljs/nyc#coverage-thresholds) for more information. This option is not available for custom providers',
            argument: '<number>',
          },
          branches: {
            description:
              'Threshold for branches. Visit [istanbuljs](https://github.com/istanbuljs/nyc#coverage-thresholds) for more information. This option is not available for custom providers',
            argument: '<number>',
          },
          statements: {
            description:
              'Threshold for statements. Visit [istanbuljs](https://github.com/istanbuljs/nyc#coverage-thresholds) for more information. This option is not available for custom providers',
            argument: '<number>',
          },
          100: {
            description:
              'Shortcut to set all coverage thresholds to 100 (default: `false`)',
          },
        },
      },
      ignoreClassMethods: {
        description:
          'Array of class method names to ignore for coverage. Visit [istanbuljs](https://github.com/istanbuljs/nyc#ignoring-methods) for more information. This option is only available for the istanbul providers (default: `[]`)',
        argument: '<name>',
        array: true,
      },
      processingConcurrency: {
        description:
          'Concurrency limit used when processing the coverage results. (default min between 20 and the number of CPUs)',
        argument: '<number>',
      },
      customProviderModule: {
        description:
          'Specifies the module name or path for the custom coverage provider module. Visit [Custom Coverage Provider](https://vitest.dev/guide/coverage#custom-coverage-provider) for more information. This option is only available for custom providers',
        argument: '<path>',
        normalize: true,
      },
      watermarks: {
        description: null,
        argument: '', // no displayed
        subcommands: {
          statements: {
            description:
              'High and low watermarks for statements in the format of `<high>,<low>`',
            argument: '<watermarks>',
            transform: watermarkTransform,
          },
          lines: {
            description:
              'High and low watermarks for lines in the format of `<high>,<low>`',
            argument: '<watermarks>',
            transform: watermarkTransform,
          },
          branches: {
            description:
              'High and low watermarks for branches in the format of `<high>,<low>`',
            argument: '<watermarks>',
            transform: watermarkTransform,
          },
          functions: {
            description:
              'High and low watermarks for functions in the format of `<high>,<low>`',
            argument: '<watermarks>',
            transform: watermarkTransform,
          },
        },
      },
    },
  },
  mode: {
    description: 'Override Vite mode (default: `test` or `benchmark`)',
    argument: '<name>',
  },
  workspace: {
    description: 'Path to a workspace configuration file',
    argument: '<path>',
    normalize: true,
  },
  isolate: {
    description:
      'Run every test file in isolation. To disable isolation, use `--no-isolate` (default: `true`)',
  },
  globals: {
    description: 'Inject apis globally',
  },
  dom: {
    description: 'Mock browser API with happy-dom',
  },
  browser: {
    description:
      'Run tests in the browser. Equivalent to `--browser.enabled` (default: `false`)',
    argument: '<name>',
    transform(browser) {
      if (typeof browser === 'boolean') {
        return { enabled: browser }
      }
      if (browser === 'true' || browser === 'false') {
        return { enabled: browser === 'true' }
      }
      if (browser === 'yes' || browser === 'no') {
        return { enabled: browser === 'yes' }
      }
      if (typeof browser === 'string') {
        return { enabled: true, name: browser }
      }
      return browser
    },
    subcommands: {
      enabled: {
        description:
          'Run tests in the browser. Equivalent to `--browser.enabled` (default: `false`)',
      },
      name: {
        description:
          'Run all tests in a specific browser. Some browsers are only available for specific providers (see `--browser.provider`). Visit [`browser.name`](https://vitest.dev/guide/browser/config/#browser-name) for more information',
        argument: '<name>',
      },
      headless: {
        description:
          'Run the browser in headless mode (i.e. without opening the GUI (Graphical User Interface)). If you are running Vitest in CI, it will be enabled by default (default: `process.env.CI`)',
      },
      api: {
        description:
          'Specify options for the browser API server. Does not affect the --api option',
        argument: '[port]',
        subcommands: apiConfig(defaultBrowserPort),
      },
      provider: {
        description:
          'Provider used to run browser tests. Some browsers are only available for specific providers. Can be "webdriverio", "playwright", "preview", or the path to a custom provider. Visit [`browser.provider`](https://vitest.dev/config/#browser-provider) for more information (default: `"preview"`)',
        argument: '<name>',
        subcommands: null, // don't support custom objects
      },
      providerOptions: {
        description:
          'Options that are passed down to a browser provider. Visit [`browser.providerOptions`](https://vitest.dev/config/#browser-provideroptions) for more information',
        argument: '<options>',
        subcommands: null, // don't support custom objects
      },
      isolate: {
        description:
          'Run every browser test file in isolation. To disable isolation, use `--browser.isolate=false` (default: `true`)',
      },
      ui: {
        description:
          'Show Vitest UI when running tests (default: `!process.env.CI`)',
      },
      fileParallelism: {
        description:
          'Should browser test files run in parallel. Use `--browser.fileParallelism=false` to disable (default: `true`)',
      },
      connectTimeout: {
        description: 'If connection to the browser takes longer, the test suite will fail (default: `60_000`)',
        argument: '<timeout>',
      },
      orchestratorScripts: null,
      testerScripts: null,
      commands: null,
      viewport: null,
      screenshotDirectory: null,
      screenshotFailures: null,
      locators: null,
      testerHtmlPath: null,
      instances: null,
    },
  },
  pool: {
    description:
      'Specify pool, if not running in the browser (default: `forks`)',
    argument: '<pool>',
    subcommands: null, // don't support custom objects
  },
  poolOptions: {
    description: 'Specify pool options',
    argument: '<options>',
    // we use casting here because TypeScript (for some reason) makes this into CLIOption<unknown>
    // even when using casting, these types fail if the new option is added which is good
    subcommands: {
      threads: {
        description: 'Specify threads pool options',
        argument: '<options>',
        subcommands: poolThreadsCommands,
      } as CLIOption<ThreadsOptions & WorkerContextOptions>,
      vmThreads: {
        description: 'Specify VM threads pool options',
        argument: '<options>',
        subcommands: {
          ...poolThreadsCommands,
          memoryLimit: {
            description:
              'Memory limit for VM threads pool. If you see memory leaks, try to tinker this value.',
            argument: '<limit>',
          },
        },
      } as CLIOption<ThreadsOptions & VmOptions>,
      forks: {
        description: 'Specify forks pool options',
        argument: '<options>',
        subcommands: poolForksCommands,
      } as CLIOption<ForksOptions & WorkerContextOptions>,
      vmForks: {
        description: 'Specify VM forks pool options',
        argument: '<options>',
        subcommands: {
          ...poolForksCommands,
          memoryLimit: {
            description:
              'Memory limit for VM forks pool. If you see memory leaks, try to tinker this value.',
            argument: '<limit>',
          },
        },
      } as CLIOption<ForksOptions & VmOptions>,
    },
  },
  fileParallelism: {
    description:
      'Should all test files run in parallel. Use `--no-file-parallelism` to disable (default: `true`)',
  },
  maxWorkers: {
    description: 'Maximum number or percentage of workers to run tests in',
    argument: '<workers>',
  },
  minWorkers: {
    description: 'Minimum number or percentage of workers to run tests in',
    argument: '<workers>',
  },
  environment: {
    description:
      'Specify runner environment, if not running in the browser (default: `node`)',
    argument: '<name>',
    subcommands: null, // don't support custom objects
  },
  passWithNoTests: {
    description: 'Pass when no tests are found',
  },
  logHeapUsage: {
    description: 'Show the size of heap for each test when running in node',
  },
  allowOnly: {
    description:
      'Allow tests and suites that are marked as only (default: `!process.env.CI`)',
  },
  dangerouslyIgnoreUnhandledErrors: {
    description: 'Ignore any unhandled errors that occur',
  },
  shard: {
    description: 'Test suite shard to execute in a format of `<index>/<count>`',
    argument: '<shards>',
  },
  changed: {
    description:
      'Run tests that are affected by the changed files (default: `false`)',
    argument: '[since]',
  },
  sequence: {
    description: 'Options for how tests should be sorted',
    argument: '<options>',
    subcommands: {
      shuffle: {
        description:
          'Run files and tests in a random order. Enabling this option will impact Vitest\'s cache and have a performance impact. May be useful to find tests that accidentally depend on another run previously (default: `false`)',
        argument: '',
        subcommands: {
          files: {
            description:
              'Run files in a random order. Long running tests will not start earlier if you enable this option. (default: `false`)',
          },
          tests: {
            description: 'Run tests in a random order (default: `false`)',
          },
        },
      },
      concurrent: {
        description: 'Make tests run in parallel (default: `false`)',
      },
      seed: {
        description:
          'Set the randomization seed. This option will have no effect if `--sequence.shuffle` is falsy. Visit ["Random Seed" page](https://en.wikipedia.org/wiki/Random_seed) for more information',
        argument: '<seed>',
      },
      hooks: {
        description:
          'Changes the order in which hooks are executed. Accepted values are: "stack", "list" and "parallel". Visit [`sequence.hooks`](https://vitest.dev/config/#sequence-hooks) for more information (default: `"parallel"`)',
        argument: '<order>',
      },
      setupFiles: {
        description:
          'Changes the order in which setup files are executed. Accepted values are: "list" and "parallel". If set to "list", will run setup files in the order they are defined. If set to "parallel", will run setup files in parallel (default: `"parallel"`)',
        argument: '<order>',
      },
    },
  },
  inspect: {
    description: 'Enable Node.js inspector (default: `127.0.0.1:9229`)',
    argument: '[[host:]port]',
    transform(portOrEnabled) {
      if (
        portOrEnabled === 0
        || portOrEnabled === 'true'
        || portOrEnabled === 'yes'
      ) {
        return true
      }
      if (portOrEnabled === 'false' || portOrEnabled === 'no') {
        return false
      }
      return portOrEnabled
    },
  },
  inspectBrk: {
    description: 'Enable Node.js inspector and break before the test starts',
    argument: '[[host:]port]',
    transform(portOrEnabled) {
      if (
        portOrEnabled === 0
        || portOrEnabled === 'true'
        || portOrEnabled === 'yes'
      ) {
        return true
      }
      if (portOrEnabled === 'false' || portOrEnabled === 'no') {
        return false
      }
      return portOrEnabled
    },
  },
  inspector: null,
  testTimeout: {
    description: 'Default timeout of a test in milliseconds (default: `5000`). Use `0` to disable timeout completely.',
    argument: '<timeout>',
  },
  hookTimeout: {
    description: 'Default hook timeout in milliseconds (default: `10000`). Use `0` to disable timeout completely.',
    argument: '<timeout>',
  },
  bail: {
    description:
      'Stop test execution when given number of tests have failed (default: `0`)',
    argument: '<number>',
  },
  retry: {
    description:
      'Retry the test specific number of times if it fails (default: `0`)',
    argument: '<times>',
  },
  diff: {
    description:
      'DiffOptions object or a path to a module which exports DiffOptions object',
    argument: '<path>',
    subcommands: {
      aAnnotation: {
        description: 'Annotation for expected lines (default: `Expected`)',
        argument: '<annotation>',
      },
      aIndicator: {
        description: 'Indicator for expected lines (default: `-`)',
        argument: '<indicator>',
      },
      bAnnotation: {
        description: 'Annotation for received lines (default: `Received`)',
        argument: '<annotation>',
      },
      bIndicator: {
        description: 'Indicator for received lines (default: `+`)',
        argument: '<indicator>',
      },
      commonIndicator: {
        description: 'Indicator for common lines (default: ` `)',
        argument: '<indicator>',
      },
      contextLines: {
        description: 'Number of lines of context to show around each change (default: `5`)',
        argument: '<lines>',
      },
      emptyFirstOrLastLinePlaceholder: {
        description: 'Placeholder for an empty first or last line (default: `""`)',
        argument: '<placeholder>',
      },
      expand: {
        description: 'Expand all common lines (default: `true`)',
      },
      includeChangeCounts: {
        description: 'Include comparison counts in diff output (default: `false`)',
      },
      omitAnnotationLines: {
        description: 'Omit annotation lines from the output (default: `false`)',
      },
      printBasicPrototype: {
        description: 'Print basic prototype Object and Array (default: `true`)',
      },
      truncateThreshold: {
        description: 'Number of lines to show before and after each change (default: `0`)',
        argument: '<threshold>',
      },
      truncateAnnotation: {
        description: 'Annotation for truncated lines (default: `... Diff result is truncated`)',
        argument: '<annotation>',
      },
    },
  },
  exclude: {
    description: 'Additional file globs to be excluded from test',
    argument: '<glob>',
    array: true,
  },
  expandSnapshotDiff: {
    description: 'Show full diff when snapshot fails',
  },
  disableConsoleIntercept: {
    description:
      'Disable automatic interception of console logging (default: `false`)',
  },
  typecheck: {
    description: 'Enable typechecking alongside tests (default: `false`)',
    argument: '', // allow boolean
    transform: transformNestedBoolean,
    subcommands: {
      enabled: {
        description: 'Enable typechecking alongside tests (default: `false`)',
      },
      only: {
        description:
          'Run only typecheck tests. This automatically enables typecheck (default: `false`)',
      },
      checker: {
        description:
          'Specify the typechecker to use. Available values are: "tsc" and "vue-tsc" and a path to an executable (default: `"tsc"`)',
        argument: '<name>',
        subcommands: null,
      },
      allowJs: {
        description:
          'Allow JavaScript files to be typechecked. By default takes the value from tsconfig.json',
      },
      ignoreSourceErrors: {
        description: 'Ignore type errors from source files',
      },
      tsconfig: {
        description: 'Path to a custom tsconfig file',
        argument: '<path>',
        normalize: true,
      },
      include: null,
      exclude: null,
    },
  },
  project: {
    description:
      'The name of the project to run if you are using Vitest workspace feature. This can be repeated for multiple projects: `--project=1 --project=2`. You can also filter projects using wildcards like `--project=packages*`, and exclude projects with `--project=!pattern`.',
    argument: '<name>',
    array: true,
  },
  slowTestThreshold: {
    description:
      'Threshold in milliseconds for a test or suite to be considered slow (default: `300`)',
    argument: '<threshold>',
  },
  teardownTimeout: {
    description:
      'Default timeout of a teardown function in milliseconds (default: `10000`)',
    argument: '<timeout>',
  },
  cache: {
    description: 'Enable cache',
    argument: '', // allow only boolean
    subcommands: {
      dir: null,
    },
    default: true,
    // cache can only be "false" or an object
    transform(cache) {
      if (typeof cache !== 'boolean' && cache) {
        throw new Error('--cache.dir is deprecated')
      }
      if (cache) {
        return {}
      }
      return cache
    },
  },
  maxConcurrency: {
    description: 'Maximum number of concurrent tests in a suite (default: `5`)',
    argument: '<number>',
  },
  expect: {
    description: 'Configuration options for `expect()` matches',
    argument: '', // no displayed
    subcommands: {
      requireAssertions: {
        description: 'Require that all tests have at least one assertion',
      },
      poll: {
        description: 'Default options for `expect.poll()`',
        argument: '',
        subcommands: {
          interval: {
            description:
              'Poll interval in milliseconds for `expect.poll()` assertions (default: `50`)',
            argument: '<interval>',
          },
          timeout: {
            description:
              'Poll timeout in milliseconds for `expect.poll()` assertions (default: `1000`)',
            argument: '<timeout>',
          },
        },
        transform(value) {
          if (typeof value !== 'object') {
            throw new TypeError(
              `Unexpected value for --expect.poll: ${value}. If you need to configure timeout, use --expect.poll.timeout=<timeout>`,
            )
          }
          return value
        },
      },
    },
    transform(value) {
      if (typeof value !== 'object') {
        throw new TypeError(
          `Unexpected value for --expect: ${value}. If you need to configure expect options, use --expect.{name}=<value> syntax`,
        )
      }
      return value
    },
  },
  printConsoleTrace: {
    description: 'Always print console stack traces',
  },
  includeTaskLocation: {
    description: 'Collect test and suite locations in the `location` property',
  },

  // CLI only options
  run: {
    description: 'Disable watch mode',
  },
  color: {
    description: 'Removes colors from the console output',
    alias: 'no-color',
  },
  clearScreen: {
    description:
      'Clear terminal screen when re-running tests during watch mode (default: `true`)',
  },
  standalone: {
    description:
      'Start Vitest without running tests. File filters will be ignored, tests will be running only on change (default: `false`)',
  },
  mergeReports: {
    description:
      'Path to a blob reports directory. If this options is used, Vitest won\'t run any tests, it will only report previously recorded tests',
    argument: '[path]',
    transform(value) {
      if (!value || typeof value === 'boolean') {
        return '.vitest-reports'
      }
      return value
    },
  },

  // disable CLI options
  cliExclude: null,
  server: null,
  setupFiles: null,
  globalSetup: null,
  snapshotFormat: null,
  snapshotSerializers: null,
  includeSource: null,
  alias: null,
  env: null,
  environmentMatchGlobs: null,
  environmentOptions: null,
  unstubEnvs: null,
  related: null,
  restoreMocks: null,
  runner: null,
  mockReset: null,
  forceRerunTriggers: null,
  unstubGlobals: null,
  uiBase: null,
  benchmark: null,
  include: null,
  testTransformMode: null,
  fakeTimers: null,
  chaiConfig: null,
  clearMocks: null,
  css: null,
  poolMatchGlobs: null,
  deps: null,
  name: null,
  snapshotEnvironment: null,
  compare: null,
  outputJson: null,
  json: null,
  provide: null,
  filesOnly: null,
}

export const benchCliOptionsConfig: Pick<
  VitestCLIOptions,
  'compare' | 'outputJson'
> = {
  compare: {
    description: 'Benchmark output file to compare against',
    argument: '<filename>',
  },
  outputJson: {
    description: 'Benchmark output file',
    argument: '<filename>',
  },
}

export const collectCliOptionsConfig: Pick<
  VitestCLIOptions,
  'json' | 'filesOnly'
> = {
  json: {
    description: 'Print collected tests as JSON or write to a file (Default: false)',
    argument: '[true/path]',
  },
  filesOnly: {
    description: 'Print only test files with out the test cases',
  },
}
