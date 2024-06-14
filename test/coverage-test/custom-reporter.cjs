/* Istanbul uses `require`: https://github.com/istanbuljs/istanbuljs/blob/5584b50305a6a17d3573aea25c84e254d4a08b65/packages/istanbul-reports/index.js#L19 */

'use strict'
const { ReportBase } = require('istanbul-lib-report')

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
    this.contentWriter.println('Start of custom coverage report')
  }

  onEnd() {
    this.contentWriter.println('End of custom coverage report')
    this.contentWriter.close()
  }
}
