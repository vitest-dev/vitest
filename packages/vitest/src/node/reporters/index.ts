import type { Reporter } from '../../types'
import { BasicReporter } from './basic'
import { DefaultReporter } from './default'
import { DotReporter } from './dot'
import { type JsonOptions, JsonReporter } from './json'
import { VerboseReporter } from './verbose'
import { TapReporter } from './tap'
import { type JUnitOptions, JUnitReporter } from './junit'
import { TapFlatReporter } from './tap-flat'
import { HangingProcessReporter } from './hanging-process'
import { GithubActionsReporter } from './github-actions'
import type { BaseOptions, BaseReporter } from './base'
import type { HTMLOptions } from './html'
import type { BlobOptions } from './blob'
import { BlobReporter } from './blob'

export {
  DefaultReporter,
  BasicReporter,
  DotReporter,
  JsonReporter,
  VerboseReporter,
  TapReporter,
  JUnitReporter,
  TapFlatReporter,
  HangingProcessReporter,
  GithubActionsReporter,
}
export type { BaseReporter, Reporter }

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
  'default': BaseOptions
  'basic': BaseOptions
  'verbose': never
  'dot': BaseOptions
  'json': JsonOptions
  'blob': BlobOptions
  'tap': never
  'tap-flat': never
  'junit': JUnitOptions
  'hanging-process': never
  'html': HTMLOptions
}

export * from './benchmark'
