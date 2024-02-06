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
import type { BaseReporter } from './base'

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

export type { JsonAssertionResult, JsonTestResult, JsonTestResults } from './json'

export const ReportersMap = {
  'default': DefaultReporter,
  'basic': BasicReporter,
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
  default: never
  basic: never
  verbose: never
  dot: never
  json: JsonOptions
  tap: never
  'tap-flat': never
  junit: JUnitOptions
  'hanging-process': never
  html: { outputFile?: string } // TODO: Any better place for defining this UI package's reporter options?
}

export * from './benchmark'
