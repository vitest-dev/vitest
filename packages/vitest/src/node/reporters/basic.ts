import { DefaultReporter } from './default'
import type { UserConsoleLog } from '#types'

export class BasicReporter extends DefaultReporter {
  isTTY = false as const

  async onTestRemoved() {
  }

  onCollected() {
  }

  async onFinished(files = this.ctx.state.getFiles(), errors = this.ctx.state.getUnhandledErrors()) {
    await super.onFinished(files, errors)
  }

  async stopListRender() {
    this.renderer = undefined
  }

  onUserConsoleLog(log: UserConsoleLog) {
    if (!this.shouldLog(log))
      return

    super.onUserConsoleLog(log)
  }
}
