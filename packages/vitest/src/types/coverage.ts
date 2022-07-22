import type { Arrayable } from './general'

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
  | NullCoverageOptions & { provider?: null }
  | C8Options & { provider?: 'c8' }

interface BaseCoverageOptions {
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
}

export interface NullCoverageOptions extends BaseCoverageOptions {
  enabled: false
}

export interface C8Options extends BaseCoverageOptions {
  /**
   * Clean coverage before running tests
   *
   * @default true
   */
  clean?: boolean
  /**
   * Check thresholds per file
   *
   * @default false
   */
  perFile?: boolean
  /**
   * Allow files from outside of your cwd.
   *
   * @default false
   */
  allowExternal?: any
  /**
   * Reporters
   *
   * @default 'text'
   */
  reporter?: Arrayable<CoverageReporter>
  /**
   * Exclude coverage under /node_modules/
   *
   * @default true
   */
  excludeNodeModules?: boolean
  exclude?: string[]
  include?: string[]
  skipFull?: boolean
  extension?: string | string[]

  all?: boolean
  src?: string[]

  100?: boolean
  lines?: number
  functions?: number
  branches?: number
  statements?: number
}

export type ResolvedCoverageOptions =
  & { tempDirectory: string }
  & Required<CoverageOptions>
