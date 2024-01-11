import type { TransformResult as ViteTransformResult } from 'vite'
import type { ReportOptions } from 'istanbul-reports'
import type { Vitest } from '../node'
import type { Arrayable } from './general'
import type { AfterSuiteRunMeta } from './worker'

type TransformResult = string | Partial<ViteTransformResult> | undefined | null | void

export interface CoverageProvider {
  name: string
  initialize(ctx: Vitest): Promise<void> | void

  resolveOptions(): ResolvedCoverageOptions
  clean(clean?: boolean): void | Promise<void>

  onAfterSuiteRun(meta: AfterSuiteRunMeta): void | Promise<void>

  reportCoverage(reportContext?: ReportContext): void | Promise<void>

  onFileTransform?(
    sourceCode: string,
    id: string,
    // TODO: when upgrading vite, import Rollup from vite
    pluginCtx: any
  ): TransformResult | Promise<TransformResult>
}

export interface ReportContext {
  /** Indicates whether all tests were run. False when only specific tests were run. */
  allTestsRun?: boolean
}

export interface CoverageProviderModule {
  /**
   * Factory for creating a new coverage provider
   */
  getProvider(): CoverageProvider | Promise<CoverageProvider>

  /**
   * Executed before tests are run in the worker thread.
   */
  startCoverage?(): unknown | Promise<unknown>

  /**
   * Executed on after each run in the worker thread. Possible to return a payload passed to the provider
   */
  takeCoverage?(): unknown | Promise<unknown>

  /**
   * Executed after all tests have been run in the worker thread.
   */
  stopCoverage?(): unknown | Promise<unknown>
}

export type CoverageReporter = keyof ReportOptions

type CoverageReporterWithOptions<ReporterName extends CoverageReporter = CoverageReporter> =
   ReporterName extends CoverageReporter
     ? ReportOptions[ReporterName] extends never
       ? [ReporterName, {}] // E.g. the "none" reporter
       : [ReporterName, Partial<ReportOptions[ReporterName]>]
     : never

type Provider = 'v8' | 'istanbul' | 'custom' | undefined

export type CoverageOptions<T extends Provider = Provider> =
  T extends 'istanbul' ? ({ provider: T } & CoverageIstanbulOptions) :
    T extends 'v8' ? ({ provider: T } & CoverageV8Options) :
      T extends 'custom' ? ({ provider: T } & CustomProviderOptions) :
          ({ provider?: T } & (CoverageV8Options))

/** Fields that have default values. Internally these will always be defined. */
type FieldsWithDefaultValues =
  | 'enabled'
  | 'clean'
  | 'cleanOnRerun'
  | 'reportsDirectory'
  | 'exclude'
  | 'extension'
  | 'reportOnFailure'
  | 'allowExternal'
  | 'processingConcurrency'

export type ResolvedCoverageOptions<T extends Provider = Provider> =
  & CoverageOptions<T>
  & Required<Pick<CoverageOptions<T>, FieldsWithDefaultValues>>
  // Resolved fields which may have different typings as public configuration API has
  & {
    reporter: CoverageReporterWithOptions[]
  }

export interface BaseCoverageOptions {
  /**
   * Enables coverage collection. Can be overridden using `--coverage` CLI option.
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
   * @default ['.js', '.cjs', '.mjs', '.ts', '.tsx', '.jsx', '.vue', '.svelte', '.marko']
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
   * @default true
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
  reporter?: Arrayable<CoverageReporter> | (CoverageReporter | [CoverageReporter] | CoverageReporterWithOptions)[]

  /**
   * Do not show files with 100% statement, branch, and function coverage
   *
   * @default false
   */
  skipFull?: boolean

  /**
   * Configurations for thresholds
   *
   * @example
   *
   * ```ts
   * {
   *   // Thresholds for all files
   *   functions: 95,
   *   branches: 70,
   *   perFile: true,
   *   autoUpdate: true,
   *
   *   // Thresholds for utilities
   *   'src/utils/**.ts': {
   *     lines: 100,
   *     statements: 95,
   *   }
   * }
   * ```
   */
  thresholds?: Thresholds | ({ [glob: string]: Pick<Thresholds, 'statements' | 'functions' | 'branches' | 'lines'> } & Thresholds)

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

  /**
   * Generate coverage report even when tests fail.
   *
   * @default false
   */
  reportOnFailure?: boolean

  /**
   * Collect coverage of files outside the project `root`.
   *
   * @default false
   */
  allowExternal?: boolean

  /**
   * Concurrency limit used when processing the coverage results.
   * Defaults to `Math.min(20, os.availableParallelism?.() ?? os.cpus().length)`
   */
  processingConcurrency?: number
}

export interface CoverageIstanbulOptions extends BaseCoverageOptions {
  /**
   * Set to array of class method names to ignore for coverage
   *
   * @default []
   */
  ignoreClassMethods?: string[]
}

export interface CoverageV8Options extends BaseCoverageOptions {}

export interface CustomProviderOptions extends Pick<BaseCoverageOptions, FieldsWithDefaultValues> {
  /** Name of the module or path to a file to load the custom provider from */
  customProviderModule: string
}

interface Thresholds {
  /** Set global thresholds to `100` */
  100?: boolean

  /** Check thresholds per file. */
  perFile?: boolean

  /**
   * Update threshold values automatically when current coverage is higher than earlier thresholds
   *
   * @default false
   */
  autoUpdate?: boolean

  /** Thresholds for statements */
  statements?: number

  /** Thresholds for functions */
  functions?: number

  /** Thresholds for branches */
  branches?: number

  /** Thresholds for lines */
  lines?: number
}
