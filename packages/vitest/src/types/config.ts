import type { AliasOptions, CommonServerOptions, DepOptimizationConfig } from 'vite'
import type { PrettyFormatOptions } from 'pretty-format'
import type { FakeTimerInstallOpts } from '@sinonjs/fake-timers'
import type { SequenceHooks, SequenceSetupFiles } from '@vitest/runner'
import type { BuiltinReporters } from '../node/reporters'
import type { TestSequencerConstructor } from '../node/sequencers/types'
import type { ChaiConfig } from '../integrations/chai'
import type { CoverageOptions, ResolvedCoverageOptions } from './coverage'
import type { JSDOMOptions } from './jsdom-options'
import type { Reporter } from './reporter'
import type { SnapshotStateOptions } from './snapshot'
import type { Arrayable } from './general'
import type { BenchmarkUserOptions } from './benchmark'
import type { BrowserConfigOptions, ResolvedBrowserOptions } from './browser'

export type { SequenceHooks, SequenceSetupFiles } from '@vitest/runner'

export type BuiltinEnvironment = 'node' | 'jsdom' | 'happy-dom' | 'edge-runtime'
// Record is used, so user can get intellisense for builtin environments, but still allow custom environments
export type VitestEnvironment = BuiltinEnvironment | (string & Record<never, never>)
export type VitestPool = 'browser' | 'threads' | 'child_process'
export type CSSModuleScopeStrategy = 'stable' | 'scoped' | 'non-scoped'

export type ApiConfig = Pick<CommonServerOptions, 'port' | 'strictPort' | 'host'>

export { JSDOMOptions }

export interface EnvironmentOptions {
  /**
   * jsdom options.
   */
  jsdom?: JSDOMOptions
  [x: string]: unknown
}

export type VitestRunMode = 'test' | 'benchmark' | 'typecheck'

interface SequenceOptions {
  /**
   * Class that handles sorting and sharding algorithm.
   * If you only need to change sorting, you can extend
   * your custom sequencer from `BaseSequencer` from `vitest/node`.
   * @default BaseSequencer
   */
  sequencer?: TestSequencerConstructor
  /**
   * Should tests run in random order.
   * @default false
   */
  shuffle?: boolean
  /**
   * Defines how setup files should be ordered
   * - 'parallel' will run all setup files in parallel
   * - 'list' will run all setup files in the order they are defined in the config file
   * @default 'parallel'
   */
  setupFiles?: SequenceSetupFiles
  /**
   * Seed for the random number generator.
   * @default Date.now()
   */
  seed?: number
  /**
   * Defines how hooks should be ordered
   * - `stack` will order "after" hooks in reverse order, "before" hooks will run sequentially
   * - `list` will order hooks in the order they are defined
   * - `parallel` will run hooks in a single group in parallel
   * @default 'parallel'
   */
  hooks?: SequenceHooks
}

interface DepsOptions {
  /**
   * Enable dependency optimization. This can improve the performance of your tests.
   */
  experimentalOptimizer?: Omit<DepOptimizationConfig, 'disabled'> & {
    enabled: boolean
  }
  /**
   * Externalize means that Vite will bypass the package to native Node.
   *
   * Externalized dependencies will not be applied Vite's transformers and resolvers.
   * And does not support HMR on reload.
   *
   * Typically, packages under `node_modules` are externalized.
   */
  external?: (string | RegExp)[]
  /**
   * Vite will process inlined modules.
   *
   * This could be helpful to handle packages that ship `.js` in ESM format (that Node can't handle).
   *
   * If `true`, every dependency will be inlined
   */
  inline?: (string | RegExp)[] | true

  /**
   * Interpret CJS module's default as named exports
   *
   * @default true
   */
  interopDefault?: boolean

  /**
   * When a dependency is a valid ESM package, try to guess the cjs version based on the path.
   * This will significantly improve the performance in huge repo, but might potentially
   * cause some misalignment if a package have different logic in ESM and CJS mode.
   *
   * @default false
   */
  fallbackCJS?: boolean

  /**
   * Use experimental Node loader to resolve imports inside node_modules using Vite resolve algorithm.
   * @default false
   */
  registerNodeLoader?: boolean
}

export interface InlineConfig {
  /**
   * Name of the project. Will be used to display in the reporter.
   */
  name?: string

  /**
   * Benchmark options.
   *
   * @default {}
  */
  benchmark?: BenchmarkUserOptions

  /**
   * Include globs for test files
   *
   * @default ['**\/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}']
   */
  include?: string[]

  /**
   * Exclude globs for test files
   * @default ['node_modules', 'dist', '.idea', '.git', '.cache']
   */
  exclude?: string[]

  /**
   * Include globs for in-source test files
   *
   * @default []
   */
  includeSource?: string[]

  /**
   * Handling for dependencies inlining or externalizing
   */
  deps?: DepsOptions

  /**
   * Base directory to scan for the test files
   *
   * @default `config.root`
   */
  dir?: string

  /**
  * Register apis globally
  *
  * @default false
  */
  globals?: boolean

  /**
   * Running environment
   *
   * Supports 'node', 'jsdom', 'happy-dom', 'edge-runtime'
   *
   * If used unsupported string, will try to load the package `vitest-environment-${env}`
   *
   * @default 'node'
   */
  environment?: VitestEnvironment

  /**
   * Environment options.
   */
  environmentOptions?: EnvironmentOptions

  /**
   * Automatically assign environment based on globs. The first match will be used.
   * This has effect only when running tests inside Node.js.
   *
   * Format: [glob, environment-name]
   *
   * @default []
   * @example [
   *   // all tests in tests/dom will run in jsdom
   *   ['tests/dom/**', 'jsdom'],
   *   // all tests in tests/ with .edge.test.ts will run in edge-runtime
   *   ['**\/*.edge.test.ts', 'edge-runtime'],
   *   // ...
   * ]
   */
  environmentMatchGlobs?: [string, VitestEnvironment][]

  /**
   * Automatically assign pool based on globs. The first match will be used.
   *
   * Format: [glob, pool-name]
   *
   * @default []
   * @example [
   *   // all tests in "child_process" directory will run using "child_process" API
   *   ['tests/child_process/**', 'child_process'],
   *   // all other tests will run based on "threads" option, if you didn't specify other globs
   *   // ...
   * ]
   */
  poolMatchGlobs?: [string, Omit<VitestPool, 'browser'>][]

  /**
   * Update snapshot
   *
   * @default false
   */
  update?: boolean

  /**
   * Watch mode
   *
   * @default true
   */
  watch?: boolean

  /**
   * Project root
   *
   * @default process.cwd()
   */
  root?: string

  /**
   * Custom reporter for output. Can contain one or more built-in report names, reporter instances,
   * and/or paths to custom reporters.
   */
  reporters?: Arrayable<BuiltinReporters | 'html' | Reporter | Omit<string, BuiltinReporters>>

  /**
   * Write test results to a file when the --reporter=json` or `--reporter=junit` option is also specified.
   * Also definable individually per reporter by using an object instead.
   */
  outputFile?: string | (Partial<Record<BuiltinReporters, string>> & Record<string, string>)

  /**
   * Enable multi-threading
   *
   * @default true
   */
  threads?: boolean

  /**
   * Maximum number of threads
   *
   * @default available CPUs
   */
  maxThreads?: number

  /**
   * Minimum number of threads
   *
   * @default available CPUs
   */
  minThreads?: number

  /**
   * Use Atomics to synchronize threads
   *
   * This can improve performance in some cases, but might cause segfault in older Node versions.
   *
   * @default false
   */
  useAtomics?: boolean

  /**
   * Default timeout of a test in milliseconds
   *
   * @default 5000
   */
  testTimeout?: number

  /**
   * Default timeout of a hook in milliseconds
   *
   * @default 10000
   */
  hookTimeout?: number

  /**
   * Default timeout to wait for close when Vitest shuts down, in milliseconds
   *
   * @default 1000
   */
  teardownTimeout?: number

  /**
   * Silent mode
   *
   * @default false
   */
  silent?: boolean

  /**
   * Hide logs for skipped tests
   *
   * @default false
   */
  hideSkippedTests?: boolean

  /**
   * Path to setup files
   */
  setupFiles?: string | string[]

  /**
   * Path to global setup files
   */
  globalSetup?: string | string[]

  /**
   * Glob pattern of file paths to be ignore from triggering watch rerun
   */
  watchExclude?: string[]

  /**
   * Glob patter of file paths that will trigger the whole suite rerun
   *
   * Useful if you are testing calling CLI commands
   *
   * @default []
   */
  forceRerunTriggers?: string[]

  /**
   * Isolate environment for each test file
   *
   * @default true
   */
  isolate?: boolean

  /**
   * Run tests inside a single thread.
   *
   * @default false
   */
  singleThread?: boolean

  /**
   * Coverage options
   */
  coverage?: CoverageOptions

  /**
   * run test names with the specified pattern
   */
  testNamePattern?: string | RegExp

  /**
   * Will call `.mockClear()` on all spies before each test
   * @default false
   */
  clearMocks?: boolean

  /**
   * Will call `.mockReset()` on all spies before each test
   * @default false
   */
  mockReset?: boolean

  /**
   * Will call `.mockRestore()` on all spies before each test
   * @default false
   */
  restoreMocks?: boolean

  /**
   * Will restore all global stubs to their original values before each test
   * @default false
   */
  unstubGlobals?: boolean

  /**
   * Will restore all env stubs to their original values before each test
   * @default false
   */
  unstubEnvs?: boolean

  /**
   * Serve API options.
   *
   * When set to true, the default port is 51204.
   *
   * @default false
   */
  api?: boolean | number | ApiConfig

  /**
   * Enable Vitest UI
   * @internal WIP
   */
  ui?: boolean

  /**
   * options for test in a browser environment
   * @experimental
   *
   * @default false
   */
  browser?: BrowserConfigOptions

  /**
   * Open UI automatically.
   *
   * @default true
   */
  open?: boolean

  /**
   * Base url for the UI
   *
   * @default '/__vitest__/'
   */
  uiBase?: string

  /**
   * Determine the transform method of modules
   */
  transformMode?: {
    /**
     * Use SSR transform pipeline for the specified files.
     * Vite plugins will receive `ssr: true` flag when processing those files.
     *
     * @default [/\.([cm]?[jt]sx?|json)$/]
     */
    ssr?: RegExp[]
    /**
     * First do a normal transform pipeline (targeting browser),
     * then then do a SSR rewrite to run the code in Node.
     * Vite plugins will receive `ssr: false` flag when processing those files.
     *
     * @default other than `ssr`
     */
    web?: RegExp[]
  }

  /**
   * Format options for snapshot testing.
   */
  snapshotFormat?: PrettyFormatOptions

  /**
   * Resolve custom snapshot path
   */
  resolveSnapshotPath?: (path: string, extension: string) => string

  /**
   * Pass with no tests
   */
  passWithNoTests?: boolean

  /**
   * Allow tests and suites that are marked as only
   */
  allowOnly?: boolean

  /**
   * Show heap usage after each test. Useful for debugging memory leaks.
   */
  logHeapUsage?: boolean

  /**
   * Custom environment variables assigned to `process.env` before running tests.
   */
  env?: Record<string, string>

  /**
   * Options for @sinon/fake-timers
   */
  fakeTimers?: FakeTimerInstallOpts

  /**
   * Custom handler for console.log in tests.
   *
   * Return `false` to ignore the log.
   */
  onConsoleLog?: (log: string, type: 'stdout' | 'stderr') => false | void

  /**
   * Indicates if CSS files should be processed.
   *
   * When excluded, the CSS files will be replaced with empty strings to bypass the subsequent processing.
   *
   * @default { include: [], modules: { classNameStrategy: false } }
   */
  css?: boolean | {
    include?: RegExp | RegExp[]
    exclude?: RegExp | RegExp[]
    modules?: {
      classNameStrategy?: CSSModuleScopeStrategy
    }
  }
  /**
   * A number of tests that are allowed to run at the same time marked with `test.concurrent`.
   * @default 5
   */
  maxConcurrency?: number

  /**
   * Options for configuring cache policy.
   * @default { dir: 'node_modules/.vitest' }
   */
  cache?: false | {
    dir?: string
  }

  /**
   * Options for configuring the order of running tests.
   */
  sequence?: SequenceOptions

  /**
   * Specifies an `Object`, or an `Array` of `Object`,
   * which defines aliases used to replace values in `import` or `require` statements.
   * Will be merged with the default aliases inside `resolve.alias`.
   */
  alias?: AliasOptions

  /**
   * Ignore any unhandled errors that occur
   */
  dangerouslyIgnoreUnhandledErrors?: boolean

  /**
   * Options for configuring typechecking test environment.
   */
  typecheck?: Partial<TypecheckConfig>

  /**
   * The number of milliseconds after which a test is considered slow and reported as such in the results.
   *
   * @default 300
  */
  slowTestThreshold?: number

  /**
   * Path to a custom test runner.
   */
  runner?: string

  /**
   * Debug tests by opening `node:inspector` in worker / child process.
   * Provides similar experience as `--inspect` Node CLI argument.
   * Requires `singleThread: true` OR `threads: false`.
   */
  inspect?: boolean

  /**
   * Debug tests by opening `node:inspector` in worker / child process and wait for debugger to connect.
   * Provides similar experience as `--inspect-brk` Node CLI argument.
   * Requires `singleThread: true` OR `threads: false`.
   */
  inspectBrk?: boolean

  /**
   * Modify default Chai config. Vitest uses Chai for `expect` and `assert` matches.
   * https://github.com/chaijs/chai/blob/4.x.x/lib/chai/config.js
  */
  chaiConfig?: ChaiConfig

  /**
   * Stop test execution when given number of tests have failed.
   */
  bail?: number

  /**
   * Glob pattern for file paths that should be treated as modules.
   *
   * @default ['**\/node_modules\/**']
   */
  modulePatterns?: string[]
}

export interface TypecheckConfig {
  /**
   * What tools to use for type checking.
   */
  checker: 'tsc' | 'vue-tsc' | (string & Record<never, never>)
  /**
   * Pattern for files that should be treated as test files
   */
  include: string[]
  /**
   * Pattern for files that should not be treated as test files
   */
  exclude: string[]
  /**
   * Check JS files that have `@ts-check` comment.
   * If you have it enabled in tsconfig, this will not overwrite it.
   */
  allowJs?: boolean
  /**
   * Do not fail, if Vitest found errors outside the test files.
   */
  ignoreSourceErrors?: boolean
  /**
   * Path to tsconfig, relative to the project root.
   */
  tsconfig?: string
}

export interface UserConfig extends InlineConfig {
  /**
   * Path to the config file.
   *
   * Default resolving to `vitest.config.*`, `vite.config.*`
   *
   * Setting to `false` will disable config resolving.
   */
  config?: string | false | undefined

  /**
   * Use happy-dom
   */
  dom?: boolean

  /**
   * Run tests that cover a list of source files
   */
  related?: string[] | string

  /**
   * Overrides Vite mode
   * @default 'test'
   */
  mode?: string

  /**
   * Runs tests that are affected by the changes in the repository, or between specified branch or commit hash
   * Requires initialized git repository
   * @default false
   */
  changed?: boolean | string

  /**
   * Test suite shard to execute in a format of <index>/<count>.
   * Will divide tests into a `count` numbers, and run only the `indexed` part.
   * Cannot be used with enabled watch.
   * @example --shard=2/3
   */
  shard?: string
}

export interface ResolvedConfig extends Omit<Required<UserConfig>, 'config' | 'filters' | 'browser' | 'coverage' | 'testNamePattern' | 'related' | 'api' | 'reporters' | 'resolveSnapshotPath' | 'benchmark' | 'shard' | 'cache' | 'sequence' | 'typecheck' | 'runner'> {
  mode: VitestRunMode

  base?: string

  config?: string
  filters?: string[]
  testNamePattern?: RegExp
  related?: string[]

  coverage: ResolvedCoverageOptions
  snapshotOptions: SnapshotStateOptions

  browser: ResolvedBrowserOptions

  reporters: (Reporter | BuiltinReporters)[]

  defines: Record<string, any>

  api?: ApiConfig

  benchmark?: Required<Omit<BenchmarkUserOptions, 'outputFile'>> & {
    outputFile?: BenchmarkUserOptions['outputFile']
  }

  shard?: {
    index: number
    count: number
  }

  cache: {
    dir: string
  } | false

  sequence: {
    sequencer: TestSequencerConstructor
    hooks: SequenceHooks
    setupFiles: SequenceSetupFiles
    shuffle?: boolean
    seed: number
  }

  typecheck: TypecheckConfig
  runner?: string
}

export type ProjectConfig = Omit<
  UserConfig,
  | 'sequencer'
  | 'shard'
  | 'watch'
  | 'run'
  | 'cache'
  | 'update'
  | 'reporters'
  | 'outputFile'
  | 'maxThreads'
  | 'minThreads'
  | 'useAtomics'
  | 'teardownTimeout'
  | 'silent'
  | 'watchExclude'
  | 'forceRerunTriggers'
  | 'testNamePattern'
  | 'ui'
  | 'open'
  | 'uiBase'
  // TODO: allow snapshot options
  | 'snapshotFormat'
  | 'resolveSnapshotPath'
  | 'passWithNoTests'
  | 'onConsoleLog'
  | 'dangerouslyIgnoreUnhandledErrors'
  | 'slowTestThreshold'
  | 'inspect'
  | 'inspectBrk'
  | 'deps'
  | 'coverage'
> & {
  sequencer?: Omit<SequenceOptions, 'sequencer' | 'seed'>
  deps?: Omit<DepsOptions, 'registerNodeLoader'>
}

export type RuntimeConfig = Pick<
  UserConfig,
  | 'allowOnly'
  | 'testTimeout'
  | 'hookTimeout'
  | 'clearMocks'
  | 'mockReset'
  | 'restoreMocks'
  | 'fakeTimers'
  | 'maxConcurrency'
> & { sequence?: { hooks?: SequenceHooks } }

export type { UserWorkspaceConfig } from '../config'
