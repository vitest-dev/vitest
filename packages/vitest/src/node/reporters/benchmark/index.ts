import { VerboseReporter } from '../verbose'
import { JsonReporter } from './json'
import { TableReporter } from './table'

export const BenchmarkReportsMap = {
  default: TableReporter,
  verbose: VerboseReporter,
  json: JsonReporter,
}
export type BenchmarkBuiltinReporters = keyof typeof BenchmarkReportsMap
