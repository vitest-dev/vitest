import type { CommonServerOptions } from 'vite'
import type { PrettyFormatOptions } from 'pretty-format'
import type { BuiltinReporters } from '../node/reporters'
import type { C8Options, ResolvedC8Options } from './coverage'
import type { JSDOMOptions } from './jsdom-options'
import type { Reporter } from './reporter'
import type { SnapshotStateOptions } from './snapshot'
import type { Arrayable } from './general'

export type BuiltinEnvironment = 'node' | 'jsdom' | 'happy-dom'

export type ApiConfig = Pick<CommonServerOptions, 'port' | 'strictPort' | 'host'>

export { JSDOMOptions }

export interface EnvironmentOptions {
  /**
   * jsdom options.
   */
  jsdom?: JSDOMOptions
}

export interface InlineConfig {
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
   * Handling for dependencies inlining or externalizing
   */
  deps?: {
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
     */
    inline?: (string | RegExp)[]

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
     * @default true
     */
    fallbackCJS?: boolean
  }

  /**
  * Register apis globally
  *
  * @default false
  */
  globals?: boolean

  /**
   * @deprecated
   */
  global?: boolean

  /**
   * Running environment
   *
   * Supports 'node', 'jsdom', 'happy-dom'
   *
   * @default 'node'
   */
  environment?: BuiltinEnvironment

  /**
   * Environment options.
   */
  environmentOptions?: EnvironmentOptions

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
   * Custom reporter for output
   */
  reporters?: Arrayable<BuiltinReporters | Reporter>

  /**
   * Write test results to a file when the --reporter=json option is also specified
   */
  outputFile?: string

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
   * Silent mode
   *
   * @default false
   */
  silent?: boolean

  /**
   * Path to setup files
   */
  setupFiles?: string | string[]

  /**
   * Path to global setup files
   */
  globalSetup?: string | string[]

  /**
   * Pattern of file paths to be ignore from triggering watch rerun
   *
   * @default ['**\/node_modules\/**', '**\/dist/**']
   */
  watchIgnore?: (string | RegExp)[]

  /**
   * Isolate environment for each test file
   *
   * @default true
   */
  isolate?: boolean

  /**
   * Coverage options
   */
  coverage?: C8Options

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
}

export interface UserConfig extends InlineConfig {
  /**
   * Path to the config file.
   *
   * Default resolving to one of:
   * - `vitest.config.js`
   * - `vitest.config.ts`
   * - `vite.config.js`
   * - `vite.config.ts`
   */
  config?: string | undefined

  /**
   * Use happy-dom
   */
  dom?: boolean

  /**
   * Pass with no tests
   */
  passWithNoTests?: boolean

  /**
   * Allow tests and suites that are marked as only
   */
  allowOnly?: boolean

  /**
   * Run tests that cover a list of source files
   */
  related?: string[] | string

  /**
   * Overrides Vite mode
   * @default 'test'
   */
  mode?: string
}

export interface ResolvedConfig extends Omit<Required<UserConfig>, 'config' | 'filters' | 'coverage' | 'testNamePattern' | 'related' | 'api' | 'reporters'> {
  base?: string

  config?: string
  filters?: string[]
  testNamePattern?: RegExp
  related?: string[]

  coverage: ResolvedC8Options
  snapshotOptions: SnapshotStateOptions

  reporters: (Reporter | BuiltinReporters)[]

  defines: Record<string, any>

  api?: ApiConfig
}
