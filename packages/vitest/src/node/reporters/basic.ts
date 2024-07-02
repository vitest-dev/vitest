import type { File } from '../../types/tasks'
import { BaseReporter } from './base'

export class BasicReporter extends BaseReporter {
  constructor() {
    super()
    this.isTTY = false
  }

  reportSummary(files: File[], errors: unknown[]) {
    // non-tty mode doesn't add a new line
    this.ctx.logger.log()
    return super.reportSummary(files, errors)
  }
}
