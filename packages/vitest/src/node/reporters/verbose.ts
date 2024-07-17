import c from 'tinyrainbow'
import type { TaskResultPack } from '../../types'
import { getFullName } from '../../utils'
import { F_RIGHT } from '../../utils/figures'
import { DefaultReporter } from './default'
import { formatProjectName, getStateSymbol } from './renderers/utils'

export class VerboseReporter extends DefaultReporter {
  protected verbose = true

  constructor() {
    super()
    this.rendererOptions.renderSucceed = true
  }

  onTaskUpdate(packs: TaskResultPack[]) {
    if (this.isTTY) {
      return
    }
    for (const pack of packs) {
      const task = this.ctx.state.idMap.get(pack[0])
      if (
        task
        && task.type === 'test'
        && task.result?.state
        && task.result?.state !== 'run'
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
