import { BaseReporter } from './base'
import type { UserConsoleLog } from '#types'

export class BasicReporter extends BaseReporter {
  isTTY = false as const

  async onTestRemoved() {
  }

  onCollected() {
  }

  async onWatcherRerun() {
  }

  onUserConsoleLog(log: UserConsoleLog) {
    if (!this.shouldLog(log))
      return

    super.onUserConsoleLog(log)
  }
}
