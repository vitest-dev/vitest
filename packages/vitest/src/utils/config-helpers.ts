import type { BenchmarkBuiltinReporters, BuiltinReporters } from '../node/reporters'

interface PotentialConfig {
  outputFile?: string | Partial<Record<string, string>>
}

export function getOutputFile(config: PotentialConfig | undefined, reporter: BuiltinReporters | BenchmarkBuiltinReporters | 'html') {
  if (!config?.outputFile)
    return

  if (typeof config.outputFile === 'string')
    return config.outputFile

  return config.outputFile[reporter]
}
