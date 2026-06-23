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
  retainSamples?: boolean

  /**
   * Disable warnings when a benchmark accesses module export getters too many times.
   * @default false
   */
  suppressExportGetterWarnings?: boolean

  /**
   * The name of the parent project that this benchmark project was cloned
   * from. Populated automatically when Vitest creates the dedicated benchmark
   * project for a parent project. Used by the runtime as the value for the
   * `${projectName}` placeholder in `writeResult` / `bench.from()` paths.
   * @internal
   */
  projectName?: string
}
