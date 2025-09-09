import { DefaultReporter } from './default'

export class TreeReporter extends DefaultReporter {
  protected verbose = true
  renderSucceed = true
}
