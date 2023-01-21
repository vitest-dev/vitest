import type { File } from '../../types/tasks'
import { BaseReporter } from './base'

export class BasicReporter extends BaseReporter {
  isTTY = false

  reportSummary(files: File[]) {
    // non-tty mode doesn't add a new line
    this.ctx.logger.log()
    return super.reportSummary(files)
  }
}
