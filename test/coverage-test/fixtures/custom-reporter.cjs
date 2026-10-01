'use strict'
const { ReportBase } = require('@vitest/istanbul-lib-report')

module.exports = class CustomReporter extends ReportBase {
  constructor(opts) {
    super()

    if (!opts.file) {
      throw new Error('File is required as custom reporter parameter')
    }

    this.file = opts.file
  }

  onStart(root, context) {
    this.contentWriter = context.writer.writeFile(this.file)
    this.contentWriter.println('Start of custom coverage report CJS')
  }

  onEnd() {
    this.contentWriter.println('End of custom coverage report CJS')
    this.contentWriter.close()
  }
}
