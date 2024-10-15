import type { Reporter } from '../types/reporter'
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
import { TestModule as _TestFile } from './reported-tasks'
import type { ModuleDiagnostic as _FileDiagnostic } from './reported-tasks'

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

export { TestCase, TestModule, TestSuite } from './reported-tasks'
/**
 * @deprecated Use `TestModule` instead
 */
export const TestFile = _TestFile
export type { TestProject } from '../reported-test-project'
export type {
  TestCollection,

  TaskOptions,
  TestDiagnostic,

  TestResult,
  TestResultFailed,
  TestResultPassed,
  TestResultSkipped,
} from './reported-tasks'
/**
 * @deprecated Use `ModuleDiagnostic` instead
 */
export type FileDiagnostic = _FileDiagnostic

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
