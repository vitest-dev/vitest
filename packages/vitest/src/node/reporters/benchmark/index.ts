import { VerboseReporter } from '../verbose'
import { JsonReporter } from './json'
export const BenchmarkReportsMap = {
  default: VerboseReporter,
  json: JsonReporter,
}
export type BenchmarkBuiltinReporters = keyof typeof BenchmarkReportsMap
