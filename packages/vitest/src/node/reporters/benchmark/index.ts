import { VerboseReporter } from '../verbose'
import { TableReporter } from './table'

export const BenchmarkReportsMap = {
  default: TableReporter,
  verbose: VerboseReporter,
}
export type BenchmarkBuiltinReporters = keyof typeof BenchmarkReportsMap
