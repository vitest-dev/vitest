export interface BenchmarkUserOptions {
  enabled?: boolean

  /**
   * Include globs for benchmark test files
   *
   * @default ['**\/*.{bench,benchmark}.?(c|m)[jt]s?(x)']
   */
  include?: string[]

  /**
   * Exclude globs for benchmark test files
   * @default []
   */
  exclude?: string[]

  /**
   * Include globs for in-source benchmark test files
   *
   * @default []
   */
  includeSource?: string[]

  /**
   * Include `samples` array of benchmark results for API or custom reporter usages.
   * This is disabled by default to reduce memory usage.
   * @default false
   */
  includeSamples?: boolean
}
