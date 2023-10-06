import type { Reporter } from '../../types'
import { BasicReporter } from './basic'
import { DefaultReporter } from './default'
import { DotReporter } from './dot'
import { JsonReporter } from './json'
import { VerboseReporter } from './verbose'
import { TapReporter } from './tap'
import { JUnitReporter } from './junit'
import { TapFlatReporter } from './tap-flat'
import { HangingProcessReporter } from './hanging-process'
import type { BaseReporter } from './base'

export {
  DefaultReporter,
  BasicReporter,
  DotReporter,
  JsonReporter,
  VerboseReporter,
  TapReporter,
  JUnitReporter,
  TapFlatReporter,
  HangingProcessReporter,
}
export type { BaseReporter, Reporter }

export const ReportersMap = {
  'default': DefaultReporter,
  'basic': BasicReporter,
  'verbose': VerboseReporter,
  'dot': DotReporter,
  'json': JsonReporter,
  'tap': TapReporter,
  'tap-flat': TapFlatReporter,
  'junit': JUnitReporter,
  'hanging-process': HangingProcessReporter,
}

export type BuiltinReporters = keyof typeof ReportersMap

export * from './benchmark'
