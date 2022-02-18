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

export interface C8Options {
  /**
   * Enable coverage, pass `--coverage` to enable
   *
   * @default false
   */
  enabled?: boolean
  /**
   * Directory to write coverage report to
   */
  reportsDirectory?: string
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

  100?: boolean
  lines?: number
  functions?: number
  branches?: number
  statements?: number
}

export interface ResolvedC8Options extends Required<C8Options> {
  tempDirectory: string
}
