import { BaseReporter } from './base'
import type { UserConsoleLog } from '#types'

export class BasicReporter extends BaseReporter {
  isTTY = false as const

  async onTestRemoved() {
  }

  onCollected() {
  }

  async onFinished(files = this.ctx.state.getFiles(), errors = this.ctx.state.getUnhandledErrors()) {
    await super.onFinished(files, errors)
  }

  onUserConsoleLog(log: UserConsoleLog) {
    if (!this.shouldLog(log)) {
      return
    }

    super.onUserConsoleLog(log)
  }
}
