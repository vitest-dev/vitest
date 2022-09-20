import type { BenchmarkBuiltinReporters, BuiltinReporters } from '../node/reporters'

interface PotentialConfig {
  outputFile?: string | Partial<Record<string, string>>
}

export const getOutputFile = (config: PotentialConfig | undefined, reporter: BuiltinReporters | BenchmarkBuiltinReporters) => {
  if (!config?.outputFile)
    return

  if (typeof config.outputFile === 'string')
    return config.outputFile

  return config.outputFile[reporter]
}
