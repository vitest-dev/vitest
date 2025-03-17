import { BenchmarkReporter } from './reporter'
import { VerboseBenchmarkReporter } from './verbose'

export {
  BenchmarkReporter,
  VerboseBenchmarkReporter,
}

export const BenchmarkReportsMap: {
  default: typeof BenchmarkReporter
  verbose: typeof VerboseBenchmarkReporter
} = {
  default: BenchmarkReporter,
  verbose: VerboseBenchmarkReporter,
}

export type BenchmarkBuiltinReporters = keyof typeof BenchmarkReportsMap
