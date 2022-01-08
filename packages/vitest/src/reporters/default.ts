import type { Task, UserConsoleLog } from '../types'
import { BaseReporter } from './base'
import type { ListRendererOptions } from './renderers/listRenderer'
import { createListRenderer } from './renderers/listRenderer'

export class DefaultReporter extends BaseReporter {
  renderer?: ReturnType<typeof createListRenderer>
  rendererOptions: ListRendererOptions = {} as any

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

  storeUserLog(log: UserConsoleLog, task?: Task | false) {
    if (!task) return

    task.logs = task.logs?.length ? [...task.logs!, log] : [log]
    this.ctx.state.idMap.set(task.id, task)
  }

  onUserConsoleLog(log: UserConsoleLog) {
    this.renderer?.clear()

    super.onUserConsoleLog(log)

    this.storeUserLog(log,
      Boolean(log?.taskId)
        && this.ctx.state.idMap.has(log.taskId!)
          && this.ctx.state.idMap.get(log.taskId!),
    )
  }
}
