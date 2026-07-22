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
   * The benchmark provider that executes registered benchmarks and produces
   * their results. Provide a path to a module whose default export implements
   * `BenchmarkProvider`. The path is resolved relative to the project
   * root. If not specified, the built-in provider is used.
   *
   * @experimental
   */
  provider?: string

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

export type ResolvedBenchmarkOptions = Omit<Required<BenchmarkUserOptions>, 'provider'> & {
  provider?: string | undefined
}
