import type { Reporter, TestRunEndReason } from '../types/reporter'
import type { BaseOptions, BaseReporter } from './base'
import type { BlobOptions } from './blob'
import type { DefaultReporterOptions } from './default'
import type { GithubActionsReporterOptions } from './github-actions'
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
import { MinimalReporter } from './minimal'
import { TapReporter } from './tap'
import { TapFlatReporter } from './tap-flat'
import { TreeReporter } from './tree'
import { VerboseReporter } from './verbose'

export {
  MinimalReporter as AgentReporter,
  DefaultReporter,
  DotReporter,
  GithubActionsReporter,
  HangingProcessReporter,
  JsonReporter,
  JUnitReporter,
  MinimalReporter,
  TapFlatReporter,
  TapReporter,
  TreeReporter,
  VerboseReporter,
}
export type { BaseReporter, Reporter, TestRunEndReason }

export type {
  JsonAssertionResult,
  JsonTestResult,
  JsonTestResults,
} from './json'

export const ReportersMap = {
  'default': DefaultReporter as typeof DefaultReporter,
  'agent': MinimalReporter as typeof MinimalReporter,
  'minimal': MinimalReporter as typeof MinimalReporter,
  'blob': BlobReporter as typeof BlobReporter,
  'verbose': VerboseReporter as typeof VerboseReporter,
  'dot': DotReporter as typeof DotReporter,
  'json': JsonReporter as typeof JsonReporter,
  'tap': TapReporter as typeof TapReporter,
  'tap-flat': TapFlatReporter as typeof TapFlatReporter,
  'junit': JUnitReporter as typeof JUnitReporter,
  'tree': TreeReporter as typeof TreeReporter,
  'hanging-process': HangingProcessReporter as typeof HangingProcessReporter,
  'github-actions': GithubActionsReporter as typeof GithubActionsReporter,
}

export type BuiltinReporters = keyof typeof ReportersMap

export interface BuiltinReporterOptions {
  'default': DefaultReporterOptions
  'minimal': DefaultReporterOptions
  'agent': DefaultReporterOptions
  'verbose': DefaultReporterOptions
  'dot': BaseOptions
  'tree': BaseOptions
  'json': JsonOptions
  'blob': BlobOptions
  'tap': never
  'tap-flat': never
  'junit': JUnitOptions
  'hanging-process': never
  'html': HTMLOptions
  'github-actions': GithubActionsReporterOptions
}

export type { ReportedHookContext } from './reported-tasks'
