import { VerboseReporter } from '../verbose'
import { BenchmarkReporter } from './reporter'

export const BenchmarkReportsMap = {
  default: BenchmarkReporter,
  verbose: VerboseReporter,
}

export type BenchmarkBuiltinReporters = keyof typeof BenchmarkReportsMap
