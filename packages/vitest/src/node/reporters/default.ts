import c from 'picocolors'
import type { UserConsoleLog } from '../../types'
import { BaseReporter } from './base'
import type { ListRendererOptions } from './renderers/listRenderer'
import { createListRenderer } from './renderers/listRenderer'

export class DefaultReporter extends BaseReporter {
  renderer?: ReturnType<typeof createListRenderer>
  rendererOptions: ListRendererOptions = {} as any

  async onReprint(trigger?: string) {
    await this.stopListRender()
    this.ctx.console.clear()
    this.ctx.log(c.blue('Test removed...') + (trigger ? c.dim(` [ ${this.relative(trigger)} ]\n`) : ''))
    this.ctx.log()
    const files = this.ctx.state.getFiles(this.watchFilters)
    if (!this.renderer)
      this.renderer = createListRenderer(files, this.rendererOptions).print()
    else
      this.renderer.update(files)
    this.ctx.log()
    await super.reportSummary(files)
    super.onWatcherStart()
  }

  onCollected() {
    if (this.isTTY) {
      this.rendererOptions.outputStream = this.ctx.outputStream
      const files = this.ctx.state.getFiles(this.watchFilters)
      if (!this.renderer)
        this.renderer = createListRenderer(files, this.rendererOptions).start()
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
    await this.renderer?.stop()
    this.renderer = undefined
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
