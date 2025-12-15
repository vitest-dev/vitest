import type { Reporter, Vitest } from 'vitest/node'
import { BaseReporter } from 'vitest/reporters'

export default class TestReporter extends BaseReporter implements Reporter {
  options?: unknown

  constructor(options?: unknown) {
    super()
    this.options = options
  }

  onInit(ctx: Vitest) {
    this.ctx = ctx
  }

  onTestRunEnd() {
    this.ctx.logger.log('hello from custom reporter')

    if (this.options) {
      this.ctx.logger.log(`custom reporter options ${JSON.stringify(this.options)}`)
    }
  }
}
