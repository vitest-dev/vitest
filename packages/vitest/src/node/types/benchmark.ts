import type { Arrayable } from '@vitest/utils'

import type { BenchmarkBuiltinReporters } from '../reporters'
import type { Reporter } from './reporter'

export interface BenchmarkUserOptions {
  /**
   * Include globs for benchmark test files
   *
   * @default ['**\/*.{bench,benchmark}.?(c|m)[jt]s?(x)']
   */
  include?: string[]

  /**
   * Exclude globs for benchmark test files
   * @default ['**\/node_modules/**', '**\/dist/**', '**\/cypress/**', '**\/.{idea,git,cache,output,temp}/**', '**\/{karma,rollup,webpack,vite,vitest,jest,ava,babel,nyc,cypress,tsup,build,eslint,prettier}.config.*']
   */
  exclude?: string[]

  /**
   * Include globs for in-source benchmark test files
   *
   * @default []
   */
  includeSource?: string[]

  /**
   * Custom reporter for output. Can contain one or more built-in report names, reporter instances,
   * and/or paths to custom reporters
   *
   * @default ['default']
   */
  reporters?: Arrayable<BenchmarkBuiltinReporters | Reporter>

  /**
   * @deprecated Use `benchmark.outputJson` instead
   */
  outputFile?:
    | string
    | (Partial<Record<BenchmarkBuiltinReporters, string>> &
      Record<string, string>)

  /**
   * benchmark output file to compare against
   */
  compare?: string

  /**
   * benchmark output file
   */
  outputJson?: string

  /**
   * Include `samples` array of benchmark results for API or custom reporter usages.
   * This is disabled by default to reduce memory usage.
   * @default false
   */
  includeSamples?: boolean
}
