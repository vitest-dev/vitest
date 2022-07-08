import c from 'picocolors'
import type { UserConsoleLog } from '../../types'
import { BaseReporter } from './base'
import type { ListRendererOptions } from './renderers/listRenderer'
import { createListRenderer } from './renderers/listRenderer'

export class DefaultReporter extends BaseReporter {
  renderer?: ReturnType<typeof createListRenderer>
  rendererOptions: ListRendererOptions = {} as any

  async onTestRemoved(trigger?: string) {
    await this.stopListRender()
    this.ctx.clearScreen(c.yellow('Test removed...') + (trigger ? c.dim(` [ ${this.relative(trigger)} ]\n`) : ''), true)
    const files = this.ctx.state.getFiles(this.watchFilters)
    createListRenderer(files, this.rendererOptions).stop()
    this.ctx.log()
    await super.reportSummary(files)
    super.onWatcherStart()
  }

  onCollected() {
    if (this.isTTY) {
      this.rendererOptions.outputStream = this.ctx.outputStream
      this.rendererOptions.showHeap = this.ctx.config.logHeapUsage
      const files = this.ctx.state.getFiles(this.watchFilters)
      if (!this.renderer)
        this.renderer = createListRenderer(files, this.rendererOptions).start()
      else
        this.renderer.update(files)
    }
  }

  async onFinished(files = this.ctx.state.getFiles(), errors = this.ctx.state.getUnhandledErrors()) {
    await this.stopListRender()
    this.ctx.log()
    await super.onFinished(files, errors)
  }

  async onWatcherStart() {
    await this.stopListRender()
    await super.onWatcherStart()
  }

  async stopListRender() {
    await this.renderer?.stop()
    this.renderer = undefined
  }

  async onWatcherRerun(files: string[], trigger?: string) {
    await this.stopListRender()
    await super.onWatcherRerun(files, trigger)
  }

  onUserConsoleLog(log: UserConsoleLog) {
    if (!this.shouldLog(log))
      return
    this.renderer?.clear()
    super.onUserConsoleLog(log)
  }
}
