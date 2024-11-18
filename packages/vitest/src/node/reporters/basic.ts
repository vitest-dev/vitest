import type { File } from '@vitest/runner'
import type { Vitest } from '../core'
import c from 'tinyrainbow'
import { BaseReporter } from './base'

export class BasicReporter extends BaseReporter {
  constructor() {
    super()
    this.isTTY = false
  }

  onInit(ctx: Vitest) {
    super.onInit(ctx)

    ctx.logger.log(c.inverse(c.bold(c.yellow(' DEPRECATED '))), c.yellow(
      `'basic' reporter is deprecated and will be removed in Vitest v3.\n`
      + `Remove 'basic' from 'reporters' option. To match 'basic' reporter 100%, use configuration:\n${
        JSON.stringify({ test: { reporters: [['default', { summary: false }]] } }, null, 2)}`,
    ))
  }

  reportSummary(files: File[], errors: unknown[]) {
    // non-tty mode doesn't add a new line
    this.ctx.logger.log()
    return super.reportSummary(files, errors)
  }
}
