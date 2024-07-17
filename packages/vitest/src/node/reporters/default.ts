import c from 'tinyrainbow'
import type { UserConsoleLog } from '../../types/general'
import { BaseReporter } from './base'
import type { ListRendererOptions } from './renderers/listRenderer'
import { createListRenderer } from './renderers/listRenderer'

export class DefaultReporter extends BaseReporter {
  renderer?: ReturnType<typeof createListRenderer>
  rendererOptions: ListRendererOptions = {} as any
  private renderSucceedDefault?: boolean

  onPathsCollected(paths: string[] = []) {
    if (this.isTTY) {
      if (this.renderSucceedDefault === undefined) {
        this.renderSucceedDefault = !!this.rendererOptions.renderSucceed
      }

      if (this.renderSucceedDefault !== true) {
        this.rendererOptions.renderSucceed = paths.length <= 1
      }
    }
  }

  async onTestRemoved(trigger?: string) {
    this.stopListRender()
    this.ctx.logger.clearScreen(
      c.yellow('Test removed...')
      + (trigger ? c.dim(` [ ${this.relative(trigger)} ]\n`) : ''),
      true,
    )
    const files = this.ctx.state.getFiles(this.watchFilters)
    createListRenderer(files, this.rendererOptions).stop()
    this.ctx.logger.log()
    super.reportSummary(files, this.ctx.state.getUnhandledErrors())
    super.onWatcherStart()
  }

  onCollected() {
    if (this.isTTY) {
      this.rendererOptions.logger = this.ctx.logger
      this.rendererOptions.showHeap = this.ctx.config.logHeapUsage
      this.rendererOptions.slowTestThreshold
        = this.ctx.config.slowTestThreshold
      this.rendererOptions.mode = this.mode
      const files = this.ctx.state.getFiles(this.watchFilters)
      if (!this.renderer) {
        this.renderer = createListRenderer(files, this.rendererOptions).start()
      }
      else {
        this.renderer.update(files)
      }
    }
  }

  onFinished(
    files = this.ctx.state.getFiles(),
    errors = this.ctx.state.getUnhandledErrors(),
  ) {
    // print failed tests without their errors to keep track of previously failed tests
    // this can happen if there are multiple test errors, and user changed a file
    // that triggered a rerun of unrelated tests - in that case they want to see
    // the error for the test they are currently working on, but still keep track of
    // the other failed tests
    this.renderer?.update([
      ...this.failedUnwatchedFiles,
      ...files,
    ])

    this.stopListRender()
    this.ctx.logger.log()
    super.onFinished(files, errors)
  }

  async onWatcherStart(
    files = this.ctx.state.getFiles(),
    errors = this.ctx.state.getUnhandledErrors(),
  ) {
    this.stopListRender()
    await super.onWatcherStart(files, errors)
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
    if (!this.shouldLog(log)) {
      return
    }
    this.renderer?.clear()
    super.onUserConsoleLog(log)
  }
}
