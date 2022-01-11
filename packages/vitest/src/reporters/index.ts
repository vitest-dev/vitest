import { DefaultReporter } from './default'
import { DotReporter } from './dot'
import { VerboseReporter } from './verbose'
import { TapReporter } from './tap'
import { TapFlatReporter } from './tap-flat'

export { DefaultReporter }

export const ReportersMap = {
  'default': DefaultReporter,
  'verbose': VerboseReporter,
  'dot': DotReporter,
  'tap': TapReporter,
  'tap-flat': TapFlatReporter,
}

export type BuiltinReporters = keyof typeof ReportersMap
