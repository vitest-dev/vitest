import c from 'picocolors'
import type { UserConsoleLog } from '../../../../types/general'
import { BaseReporter } from '../../base'
import { getFullName } from '../../../../utils'
import type { TaskResultPack } from '../../../../types'
import { getStateSymbol } from '../../renderers/utils'
import { type TableRendererOptions, createTableRenderer, renderTree } from './tableRender'

export class TableReporter extends BaseReporter {
  renderer?: ReturnType<typeof createTableRenderer>
  rendererOptions: TableRendererOptions = {} as any

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
    this.rendererOptions.logger = this.ctx.logger
    this.rendererOptions.showHeap = this.ctx.config.logHeapUsage
    this.rendererOptions.slowTestThreshold = this.ctx.config.slowTestThreshold
    this.rendererOptions.recurse = this.isTTY
    if (this.isTTY) {
      const files = this.ctx.state.getFiles(this.watchFilters)
      if (!this.renderer)
        this.renderer = createTableRenderer(files, this.rendererOptions).start()
      else
        this.renderer.update(files)
    }
  }

  onTaskUpdate(packs: TaskResultPack[]) {
    if (this.isTTY)
      return
    for (const pack of packs) {
      const task = this.ctx.state.idMap.get(pack[0])
      if (task && task.type === 'suite' && task.result?.state && task.result?.state !== 'run') {
        // render static table when all benches inside single suite are finished
        const benches = task.tasks.filter(t => t.meta.benchmark)
        if (benches.length > 0 && benches.every(t => t.result?.state !== 'run')) {
          this.ctx.logger.log(` ${getStateSymbol(task)} ${getFullName(task, c.dim(' > '))}`)
          this.ctx.logger.log(renderTree(benches, this.rendererOptions, 1))
        }
      }
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
