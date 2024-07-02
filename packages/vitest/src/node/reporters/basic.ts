import { hasFailed } from '@vitest/runner/utils'
import type { File } from '../../types/tasks'
import { BaseReporter } from './base'

export class BasicReporter extends BaseReporter {
  isTTY = false

  onWatcherRerun(files: string[], trigger?: string) {
    super.onWatcherRerun(files, trigger)

    const failedTasks = this.ctx.state.getFiles().filter((file) => {
      return hasFailed(file) && !files.includes(file.filepath)
    })

    for (const task of failedTasks) {
      this.printTask(task)
    }
  }

  reportSummary(files: File[], errors: unknown[]) {
    // non-tty mode doesn't add a new line
    this.ctx.logger.log()
    return super.reportSummary(files, errors)
  }
}
