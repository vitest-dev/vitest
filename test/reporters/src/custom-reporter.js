export default class TestReporter {
  onInit(ctx) {
    this.ctx = ctx
  }

  onTestRunEnd() {
    this.ctx.logger.log('hello from custom reporter')
  }
}
