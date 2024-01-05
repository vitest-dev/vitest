import c from 'picocolors'
import type { UserConsoleLog } from '../../../../types/general'
import { BaseReporter } from '../../base'
import type { ListRendererOptions } from '../../renderers/listRenderer'
import { createTableRenderer } from './tableRender'

export class TableReporter extends BaseReporter {
  renderer?: ReturnType<typeof createTableRenderer>
  rendererOptions: ListRendererOptions = {} as any

  async onTestRemoved(trigger?: string) {
    await this.stopListRender()
    this.ctx.logger.clearScreen(c.yellow('Test removed...') + (trigger ? c.dim(` [ ${this.relative(trigger)} ]\n`) : ''), true)
    const files = this.ctx.state.getFiles(this.watchFilters)
    createTableRenderer(files, this.rendererOptions).stop()
    this.ctx.logger.log()
    await super.reportSummary(files, this.ctx.state.getUnhandledErrors())
    super.onWatcherStart()
  }

  onCollected() {
    if (this.isTTY) {
      this.rendererOptions.logger = this.ctx.logger
      this.rendererOptions.showHeap = this.ctx.config.logHeapUsage
      this.rendererOptions.slowTestThreshold = this.ctx.config.slowTestThreshold
      const files = this.ctx.state.getFiles(this.watchFilters)
      if (!this.renderer)
        this.renderer = createTableRenderer(files, this.rendererOptions).start()
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
