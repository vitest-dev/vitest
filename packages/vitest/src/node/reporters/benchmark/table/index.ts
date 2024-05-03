import c from 'picocolors'
import type { TaskResultPack } from '@vitest/runner'
import type { UserConsoleLog } from '../../../../types/general'
import { BaseReporter } from '../../base'
import { getFullName } from '../../../../utils'
import { getStateSymbol } from '../../renderers/utils'
import { type TableRendererOptions, createTableRenderer, renderTree } from './tableRender'

export class TableReporter extends BaseReporter {
  renderer?: ReturnType<typeof createTableRenderer>
  rendererOptions: TableRendererOptions = {} as any

  onTestRemoved(trigger?: string) {
    this.stopListRender()
    this.ctx.logger.clearScreen(c.yellow('Test removed...') + (trigger ? c.dim(` [ ${this.relative(trigger)} ]\n`) : ''), true)
    const files = this.ctx.state.getFiles(this.watchFilters)
    createTableRenderer(files, this.rendererOptions).stop()
    this.ctx.logger.log()
    super.reportSummary(files, this.ctx.state.getUnhandledErrors())
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

  onTaskUpdate(packs: TaskResultPack[]) {
    if (this.isTTY)
      return
    for (const pack of packs) {
      const task = this.ctx.state.idMap.get(pack[0])
      if (task && task.type === 'suite' && task.result?.state && task.result?.state !== 'run') {
        // render static table when all benches inside single suite are finished
        const benches = task.tasks.filter(t => t.meta.benchmark)
        if (benches.length > 0 && benches.every(t => t.result?.state !== 'run')) {
          let title = ` ${getStateSymbol(task)} ${getFullName(task, c.dim(' > '))}`
          if (task.result.duration != null && task.result.duration > this.ctx.config.slowTestThreshold)
            title += c.yellow(` ${Math.round(task.result.duration)}${c.dim('ms')}`)
          this.ctx.logger.log(title)
          this.ctx.logger.log(renderTree(benches, this.rendererOptions, 1, true))
        }
      }
    }
  }

  onFinished(files = this.ctx.state.getFiles(), errors = this.ctx.state.getUnhandledErrors()) {
    this.stopListRender()
    this.ctx.logger.log()
    super.onFinished(files, errors)
  }

  async onWatcherStart() {
    this.stopListRender()
    await super.onWatcherStart()
  }

  stopListRender() {
    this.renderer?.stop()
    this.renderer = undefined
  }

  async onWatcherRerun(files: string[], trigger?: string) {
    this.stopListRender()
    await super.onWatcherRerun(files, trigger)
  }

  onUserConsoleLog(log: UserConsoleLog) {
    if (!this.shouldLog(log))
      return
    this.renderer?.clear()
    super.onUserConsoleLog(log)
  }
}
