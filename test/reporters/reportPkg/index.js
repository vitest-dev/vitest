export default class PackageReporter {
  onInit(ctx) {
    this.ctx = ctx
  }

  onTestRunEnd() {
    this.ctx.logger.log('hello from package reporter')
  }
}
