import type { TaskResultPack } from '@vitest/runner'
import { getFullName } from '@vitest/runner/utils'
import c from 'tinyrainbow'
import { DefaultReporter } from './default'
import { F_RIGHT } from './renderers/figures'
import { formatProjectName, getStateSymbol } from './renderers/utils'

export class VerboseReporter extends DefaultReporter {
  protected verbose = true
  renderSucceed = true

  onTaskUpdate(packs: TaskResultPack[]) {
    if (this.isTTY) {
      return super.onTaskUpdate(packs)
    }
    for (const pack of packs) {
      const task = this.ctx.state.idMap.get(pack[0])
      if (
        task
        && task.type === 'test'
        && task.result?.state
        && task.result?.state !== 'run'
        && task.result?.state !== 'queued'
      ) {
        let title = ` ${getStateSymbol(task)} `
        if (task.file.projectName) {
          title += formatProjectName(task.file.projectName)
        }
        title += getFullName(task, c.dim(' > '))
        if (
          task.result.duration != null
          && task.result.duration > this.ctx.config.slowTestThreshold
        ) {
          title += c.yellow(
            ` ${Math.round(task.result.duration)}${c.dim('ms')}`,
          )
        }
        if (this.ctx.config.logHeapUsage && task.result.heap != null) {
          title += c.magenta(
            ` ${Math.floor(task.result.heap / 1024 / 1024)} MB heap used`,
          )
        }
        if (task.result?.note) {
          title += c.dim(c.gray(` [${task.result.note}]`))
        }
        this.ctx.logger.log(title)
        if (task.result.state === 'fail') {
          task.result.errors?.forEach((error) => {
            this.ctx.logger.log(c.red(`   ${F_RIGHT} ${error?.message}`))
          })
        }
      }
    }
  }
}
