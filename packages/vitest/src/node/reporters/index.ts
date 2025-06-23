import type { Reporter, TestRunEndReason } from '../types/reporter'
import type { BaseOptions, BaseReporter } from './base'
import type { BlobOptions } from './blob'
import type { DefaultReporterOptions } from './default'
import type { HTMLOptions } from './html'
import type { JsonOptions } from './json'
import type { JUnitOptions } from './junit'
import { BlobReporter } from './blob'
import { DefaultReporter } from './default'
import { DotReporter } from './dot'
import { GithubActionsReporter } from './github-actions'
import { HangingProcessReporter } from './hanging-process'
import { JsonReporter } from './json'
import { JUnitReporter } from './junit'
import { TapReporter } from './tap'
import { TapFlatReporter } from './tap-flat'
import { VerboseReporter } from './verbose'

export {
  DefaultReporter,
  DotReporter,
  GithubActionsReporter,
  HangingProcessReporter,
  JsonReporter,
  JUnitReporter,
  TapFlatReporter,
  TapReporter,
  VerboseReporter,
}
export type { BaseReporter, Reporter, TestRunEndReason }

export type { BenchmarkBuiltinReporters } from './benchmark'
export {
  BenchmarkReporter,
  BenchmarkReportsMap,
  VerboseBenchmarkReporter,
} from './benchmark'
export type {
  JsonAssertionResult,
  JsonTestResult,
  JsonTestResults,
} from './json'

export const ReportersMap = {
  'default': DefaultReporter as typeof DefaultReporter,
  'blob': BlobReporter as typeof BlobReporter,
  'verbose': VerboseReporter as typeof VerboseReporter,
  'dot': DotReporter as typeof DotReporter,
  'json': JsonReporter as typeof JsonReporter,
  'tap': TapReporter as typeof TapReporter,
  'tap-flat': TapFlatReporter as typeof TapFlatReporter,
  'junit': JUnitReporter as typeof JUnitReporter,
  'hanging-process': HangingProcessReporter as typeof HangingProcessReporter,
  'github-actions': GithubActionsReporter as typeof GithubActionsReporter,
}

export type BuiltinReporters = keyof typeof ReportersMap

export interface BuiltinReporterOptions {
  'default': DefaultReporterOptions
  'verbose': DefaultReporterOptions
  'dot': BaseOptions
  'json': JsonOptions
  'blob': BlobOptions
  'tap': never
  'tap-flat': never
  'junit': JUnitOptions
  'hanging-process': never
  'html': HTMLOptions
}

export type { ReportedHookContext } from './reported-tasks'
