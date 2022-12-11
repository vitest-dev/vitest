import type { TransformPluginContext, TransformResult } from 'rollup'
import type { Vitest } from '../node'
import type { Arrayable } from './general'
import type { AfterSuiteRunMeta } from './worker'

export interface CoverageProvider {
  name: string
  initialize(ctx: Vitest): Promise<void> | void

  resolveOptions(): ResolvedCoverageOptions
  clean(clean?: boolean): void | Promise<void>

  onBeforeFilesRun?(): void | Promise<void>
  onAfterSuiteRun(meta: AfterSuiteRunMeta): void | Promise<void>

  reportCoverage(): void | Promise<void>

  onFileTransform?(
    sourceCode: string,
    id: string,
    pluginCtx: TransformPluginContext
  ): TransformResult | Promise<TransformResult>
}

export interface CoverageProviderModule {
  /**
   * Factory for creating a new coverage provider
   */
  getProvider(): CoverageProvider | Promise<CoverageProvider>
  /**
   * Executed on after each run in the worker thread. Possible to return a payload passed to the provider
   */
  takeCoverage?(): unknown | Promise<unknown>
}

export type CoverageReporter =
  | 'clover'
  | 'cobertura'
  | 'html-spa'
  | 'html'
  | 'json-summary'
  | 'json'
  | 'lcov'
  | 'lcovonly'
  | 'none'
  | 'teamcity'
  | 'text-lcov'
  | 'text-summary'
  | 'text'

export type CoverageOptions =
  | BaseCoverageOptions & { provider?: null | CoverageProviderModule }
  | CoverageC8Options & { provider?: 'c8' }
  | CoverageIstanbulOptions & { provider?: 'istanbul' }

export type ResolvedCoverageOptions =
  & { tempDirectory: string }
  & Required<CoverageOptions>

export interface BaseCoverageOptions {
  /**
   * Enables coverage collection. Can be overriden using `--coverage` CLI option.
   *
   * @default false
   */
  enabled?: boolean

  /**
   * List of files included in coverage as glob patterns
   *
   * @default ['**']
   */
  include?: string[]

  /**
    * Extensions for files to be included in coverage
    *
    * @default ['.js', '.cjs', '.mjs', '.ts', '.tsx', '.jsx', '.vue', '.svelte']
    */
  extension?: string | string[]

  /**
    * List of files excluded from coverage as glob patterns
    */
  exclude?: string[]

  /**
   * Whether to include all files, including the untested ones into report
   *
   * @default false
   */
  all?: boolean

  /**
   * Clean coverage results before running tests
   *
   * @default true
   */
  clean?: boolean

  /**
   * Clean coverage report on watch rerun
   *
   * @default false
   */
  cleanOnRerun?: boolean

  /**
   * Directory to write coverage report to
   */
  reportsDirectory?: string

  /**
   * Coverage reporters to use.
   * See [istanbul documentation](https://istanbul.js.org/docs/advanced/alternative-reporters/) for detailed list of all reporters.
   *
   * @default ['text', 'html', 'clover', 'json']
   */
  reporter?: Arrayable<CoverageReporter>

  /**
   * Do not show files with 100% statement, branch, and function coverage
   *
   * @default false
   */
  skipFull?: boolean

  /**
   * Check thresholds per file.
   * See `lines`, `functions`, `branches` and `statements` for the actual thresholds.
   *
   * @default false
   */
  perFile?: boolean

  /**
   * Threshold for lines
   *
   * @default undefined
   */
  lines?: number

  /**
   * Threshold for functions
   *
   * @default undefined
   */
  functions?: number

  /**
   * Threshold for branches
   *
   * @default undefined
   */
  branches?: number

  /**
   * Threshold for statements
   *
   * @default undefined
   */
  statements?: number
}

export interface CoverageIstanbulOptions extends BaseCoverageOptions {
  /**
   * Set to array of class method names to ignore for coverage
   *
   * @default []
   */
  ignoreClassMethods?: string[]

  /**
   * Watermarks for statements, lines, branches and functions.
   *
   * Default value is `[50,80]` for each property.
   */
  watermarks?: {
    statements?: [number, number]
    functions?: [number, number]
    branches?: [number, number]
    lines?: [number, number]
  }
}

export interface CoverageC8Options extends BaseCoverageOptions {
  /**
   * Allow files from outside of your cwd.
   *
   * @default false
   */
  allowExternal?: boolean

  /**
   * Exclude coverage under `/node_modules/`
   *
   * @default true
   */
  excludeNodeModules?: boolean

  /**
   * Specifies the directories that are used when `--all` is enabled.
   *
   * @default cwd
  */
  src?: string[]

  /**
   * Shortcut for `--check-coverage --lines 100 --functions 100 --branches 100 --statements 100`
   *
   * @default false
   */
  100?: boolean
}
