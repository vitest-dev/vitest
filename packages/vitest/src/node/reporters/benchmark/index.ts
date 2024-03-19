import { VerboseReporter } from '../verbose'
import { CompareReporter } from './compare'
import { JsonReporter } from './json'
import { TableReporter } from './table'

export const BenchmarkReportsMap = {
  default: TableReporter,
  verbose: VerboseReporter,
  json: JsonReporter,
  wip: CompareReporter,
}
export type BenchmarkBuiltinReporters = keyof typeof BenchmarkReportsMap
