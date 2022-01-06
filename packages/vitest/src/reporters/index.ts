import { DefaultReporter } from './default'
import { DotReporter } from './dot'
import { VerboseReporter } from './verbose'
import { TapReporter } from './tap'

export { DefaultReporter }

export const ReportersMap = {
  default: DefaultReporter,
  verbose: VerboseReporter,
  dot: DotReporter,
  tap: TapReporter,
}

export type BuiltinReporters = keyof typeof ReportersMap
