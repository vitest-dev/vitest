import type { Reporter, TestRunEndReason } from '../types/reporter'
import type { BaseOptions, BaseReporter } from './base'
import type { BlobOptions } from './blob'
import type { DefaultReporterOptions } from './default'
import type { HTMLOptions } from './html'
import { BasicReporter } from './basic'
import { BlobReporter } from './blob'
import { DefaultReporter } from './default'
import { DotReporter } from './dot'
import { GithubActionsReporter } from './github-actions'
import { HangingProcessReporter } from './hanging-process'
import { type JsonOptions, JsonReporter } from './json'
import { type JUnitOptions, JUnitReporter } from './junit'
import { TapReporter } from './tap'
import { TapFlatReporter } from './tap-flat'
import { VerboseReporter } from './verbose'

export {
  BasicReporter,
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

export {
  BenchmarkBuiltinReporters,
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
  'default': DefaultReporter,
  'basic': BasicReporter,
  'blob': BlobReporter,
  'verbose': VerboseReporter,
  'dot': DotReporter,
  'json': JsonReporter,
  'tap': TapReporter,
  'tap-flat': TapFlatReporter,
  'junit': JUnitReporter,
  'hanging-process': HangingProcessReporter,
  'github-actions': GithubActionsReporter,
}

export type BuiltinReporters = keyof typeof ReportersMap

export interface BuiltinReporterOptions {
  'default': DefaultReporterOptions
  'basic': BaseOptions
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
