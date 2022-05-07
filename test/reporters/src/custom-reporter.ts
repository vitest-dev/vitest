import type { Reporter, Vitest } from 'vitest'

export default class TestReporter implements Reporter {
  ctx!: Vitest

  onInit(ctx: Vitest) {
    this.ctx = ctx
  }

  onFinished() {
    this.ctx.log('hello from custom reporter')
  }
}
