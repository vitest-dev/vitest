import { DefaultReporter } from './default'
import { DotReporter } from './dot'
import { JsonReporter } from './json'
import { VerboseReporter } from './verbose'
import { TapReporter } from './tap'
import { TapFlatReporter } from './tap-flat'

export { DefaultReporter }

export const ReportersMap = {
  'default': DefaultReporter,
  'verbose': VerboseReporter,
  'dot': DotReporter,
  'json': JsonReporter,
  'tap': TapReporter,
  'tap-flat': TapFlatReporter,
}

export type BuiltinReporters = keyof typeof ReportersMap
