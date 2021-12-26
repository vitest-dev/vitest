import { DefaultReporter } from './default'

export class VerboseReporter extends DefaultReporter {
  constructor() {
    super()
    this.rendererOptions.renderSucceed = true
  }
}
