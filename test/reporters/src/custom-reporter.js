export default class TestReporter {
  onInit(ctx) {
    this.ctx = ctx
  }

  onFinished() {
    this.ctx.logger.log('hello from custom reporter')
  }
}
