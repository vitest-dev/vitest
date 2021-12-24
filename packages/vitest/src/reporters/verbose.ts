import type { Vitest } from '../node'
import { DefaultReporter } from './default'

export class VerboseReporter extends DefaultReporter {
  constructor(ctx: Vitest) {
    super(ctx)
    this.rendererOptions.renderSucceed = true
  }
}
