export {
  BenchmarkReporter,
  BenchmarkReportsMap,
  DefaultReporter,
  DotReporter,
  GithubActionsReporter,
  HangingProcessReporter,
  JsonReporter,
  JUnitReporter,
  ReportersMap,
  TapFlatReporter,
  TapReporter,
  VerboseBenchmarkReporter,
  VerboseReporter,
} from '../node/reporters'
export type {
  BaseReporter,
  BenchmarkBuiltinReporters,
  BuiltinReporterOptions,
  BuiltinReporters,
  JsonAssertionResult,
  JsonTestResult,
  JsonTestResults,
  ReportedHookContext,
  Reporter,
  TestRunEndReason,
} from '../node/reporters'

console.warn('Importing from "vitest/reporters" is deprecated since Vitest 4.1. Please use "vitest/node" instead.')
