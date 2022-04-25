export default class TestReporter {
  onInit(ctx) {
    this.ctx = ctx
  }

  onFinished() {
    this.ctx.log('hello from custom reporter')
  }
}
