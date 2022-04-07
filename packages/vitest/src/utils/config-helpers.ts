import type { Vitest } from '../node/core'
import type { BuiltinReporters } from '../node/reporters'

export const getOutputFile = ({ config }: Vitest, reporter: BuiltinReporters) => {
  if (!config.outputFile)
    return

  if (typeof config.outputFile === 'string')
    return config.outputFile

  return config.outputFile[reporter]
}
