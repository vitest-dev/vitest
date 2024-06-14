import type { Reporter, Vitest } from 'vitest'

export default class TestReporter implements Reporter {
  ctx!: Vitest
  options?: unknown

  constructor(options?: unknown) {
    this.options = options
  }

  onInit(ctx: Vitest) {
    this.ctx = ctx
  }

  onFinished() {
    this.ctx.logger.log('hello from custom reporter')

    if (this.options) {
      this.ctx.logger.log(`custom reporter options ${JSON.stringify(this.options)}`)
    }
  }
}
