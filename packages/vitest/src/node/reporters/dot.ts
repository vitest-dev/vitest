import type { UserConsoleLog } from '../../types/general'
import { BaseReporter } from './base'
import { createDotRenderer } from './renderers/dotRenderer'

export class DotReporter extends BaseReporter {
  renderer?: ReturnType<typeof createDotRenderer>

  onCollected() {
    if (this.isTTY) {
      const files = this.ctx.state.getFiles(this.watchFilters)
      if (!this.renderer)
        this.renderer = createDotRenderer(files, { logger: this.ctx.logger }).start()
      else
        this.renderer.update(files)
    }
  }

  async onFinished(files = this.ctx.state.getFiles(), errors = this.ctx.state.getUnhandledErrors()) {
    await this.stopListRender()
    this.ctx.logger.log()
    await super.onFinished(files, errors)
  }

  async onWatcherStart() {
    await this.stopListRender()
    super.onWatcherStart()
  }

  async stopListRender() {
    this.renderer?.stop()
    this.renderer = undefined
    await new Promise(resolve => setTimeout(resolve, 10))
  }

  async onWatcherRerun(files: string[], trigger?: string) {
    await this.stopListRender()
    await super.onWatcherRerun(files, trigger)
  }

  onUserConsoleLog(log: UserConsoleLog) {
    this.renderer?.clear()
    super.onUserConsoleLog(log)
  }
}
