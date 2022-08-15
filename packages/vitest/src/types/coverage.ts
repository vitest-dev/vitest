import type { TransformPluginContext, TransformResult } from 'rollup'
import type { Vitest } from '../node'
import type { Arrayable } from './general'

export interface CoverageProvider {
  name: string
  initialize(ctx: Vitest): Promise<void> | void

  resolveOptions(): ResolvedCoverageOptions
  clean(clean?: boolean): void | Promise<void>

  onBeforeFilesRun?(): void | Promise<void>
  onAfterSuiteRun(collectedCoverage: any): void | Promise<void>

  reportCoverage(): void | Promise<void>

  onFileTransform?(
    sourceCode: string,
    id: string,
    pluginCtx: TransformPluginContext
  ): TransformResult | Promise<TransformResult>
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
  | BaseCoverageOptions & { provider?: null }
  | CoverageC8Options & { provider?: 'c8' }
  | CoverageIstanbulOptions & { provider?: 'istanbul' }

export type ResolvedCoverageOptions =
  & { tempDirectory: string }
  & Required<CoverageOptions>

export interface BaseCoverageOptions {
  /**
   * Enable coverage, pass `--coverage` to enable
   *
   * @default false
   */
  enabled?: boolean

  /**
   * Clean coverage before running tests
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
   * Reporters
   *
   * @default 'text'
   */
  reporter?: Arrayable<CoverageReporter>

  /**
   * List of files excluded from coverage as glob patterns
   */
  exclude?: string[]

  /**
   * Do not show files with 100% statement, branch, and function coverage
   */
  skipFull?: boolean

  /**
   * Check thresholds per file
   *
   * @default false
   */
  perFile?: boolean

  /**
   * Threshold for lines
   */
  lines?: number

  /**
   * Threshold for functions
   */
  functions?: number

  /**
   * Threshold for branches
   */
  branches?: number

  /**
   * Threshold for statements
   */
  statements?: number
}

export interface CoverageIstanbulOptions extends BaseCoverageOptions {
  /* Set to array of class method names to ignore for coverage */
  ignoreClassMethods?: string[]

  /* Watermarks for statements, lines, branches and functions */
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
  allowExternal?: any
  /**
   * Exclude coverage under /node_modules/
   *
   * @default true
   */
  excludeNodeModules?: boolean
  include?: string[]
  extension?: string | string[]

  all?: boolean
  src?: string[]

  100?: boolean
}
