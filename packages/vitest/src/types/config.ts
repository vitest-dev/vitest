import type { BuiltinReporters } from '../reporters'
import type { C8Options, ResolvedC8Options } from '../coverage'
import type { Reporter } from './reporter'
import type { SnapshotStateOptions } from './snapshot'
import type { Arrayable } from './general'

export type BuiltinEnvironment = 'node' | 'jsdom' | 'happy-dom'

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
  }

  /**
   * Register apis globally
   *
   * @default false
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
   * Update snapshot files
   *
   * @default false
   */
  update?: boolean

  /**
   * Watch mode
   *
   * @default false
   */
  watch?: boolean

  /**
   * Project root
   */
  root?: string

  /**
   * Custom reporter for output
   */
  reporters?: Arrayable<BuiltinReporters | Reporter>

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

  /*
   * Interpret CJS module's default as named exports
   *
   * @default true
   */
  interpretDefault?: boolean

  /**
   * Default timeout of a test in milliseconds
   *
   * @default 5000
   */
  testTimeout?: number

  /**
   * Default timeout of a hook in milliseconds
   *
   * @default 5000
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
   * Open Vitest UI
   * @internal WIP
   */
  open?: boolean

  /**
   * run test names with the specified pattern
   */
  testNamePattern?: string | RegExp

  /**
   * Listen to port and serve API
   *
   * When set to true, the default port is 55555
   *
   * @internal WIP
   * @default false
   */
  api?: boolean | number

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
   * Do not watch
   */
  run?: boolean

  /**
   * Pass with no tests
   */
  passWithNoTests?: boolean

  /**
   * Run tests that cover a list of source files
   */
  findRelatedTests?: string[] | string
}

export interface ResolvedConfig extends Omit<Required<UserConfig>, 'config' | 'filters' | 'coverage' | 'testNamePattern' | 'findRelatedTests'> {
  config?: string
  filters?: string[]
  testNamePattern?: RegExp
  findRelatedTests?: string[]

  depsInline: (string | RegExp)[]
  depsExternal: (string | RegExp)[]

  coverage: ResolvedC8Options
  snapshotOptions: SnapshotStateOptions
}
