import type { UserConsoleLog } from '../../types'
import { BaseReporter } from './base'
import { createDotRenderer } from './renderers/dotRenderer'
import type { createListRenderer } from './renderers/listRenderer'

export class DotReporter extends BaseReporter {
  renderer?: ReturnType<typeof createListRenderer>

  onCollected() {
    if (this.isTTY) {
      const files = this.ctx.state.getFiles(this.watchFilters)
      if (!this.renderer)
        this.renderer = createDotRenderer(files, { outputStream: this.ctx.outputStream }).start()
      else
        this.renderer.update(files)
    }
  }

  async onFinished(files = this.ctx.state.getFiles()) {
    await this.stopListRender()
    this.ctx.log()
    await super.onFinished(files)
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
