export default class PackageReporter {
  onInit(ctx) {
    this.ctx = ctx
  }

  onFinished() {
    this.ctx.logger.log('hello from package reporter')
  }
}
