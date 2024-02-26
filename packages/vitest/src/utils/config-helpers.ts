import type { ResolvedConfig } from '../types/config'
import type { BenchmarkBuiltinReporters, BuiltinReporters } from '../node/reporters'

const REGEXP_WRAP_PREFIX = '$$vitest:'

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

/**
 * Prepares `ResolvedConfig` for serialization, e.g. `node:v8.serialize`
 */
export function wrapSerializableConfig(config: ResolvedConfig) {
  let testNamePattern = config.testNamePattern

  // v8 serialize does not support regex
  if (testNamePattern && typeof testNamePattern !== 'string')
    testNamePattern = `${REGEXP_WRAP_PREFIX}${testNamePattern.toString()}` as unknown as RegExp

  return {
    ...config,
    testNamePattern,
  } as ResolvedConfig
}
