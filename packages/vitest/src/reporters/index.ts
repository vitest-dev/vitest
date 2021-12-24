import { DefaultReporter } from './default'
import { DotReporter } from './dot'
import { VerboseReporter } from './verbose'

export { DefaultReporter }

export const ReportersMap = {
  default: DefaultReporter,
  verbose: VerboseReporter,
  dot: DotReporter,
}

export type BuiltinReporters = keyof typeof ReportersMap
