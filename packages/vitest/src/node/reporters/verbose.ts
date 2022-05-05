import c from 'picocolors'
import type { TaskResultPack } from '../../types'
import { getFullName } from '../../utils'
import { F_RIGHT } from '../../utils/figures'
import { DefaultReporter } from './default'
import { getStateSymbol } from './renderers/utils'

export class VerboseReporter extends DefaultReporter {
  constructor() {
    super()
    this.rendererOptions.renderSucceed = true
  }

  onTaskUpdate(packs: TaskResultPack[]) {
    if (this.isTTY)
      return
    for (const pack of packs) {
      const task = this.ctx.state.idMap.get(pack[0])
      if (task && task.type === 'test' && task.result?.state && task.result?.state !== 'run') {
        let title = ` ${getStateSymbol(task)} ${getFullName(task)}`
        if (this.ctx.config.logHeapUsage && task.result.heap != null)
          title += c.magenta(` ${Math.floor(task.result.heap / 1024 / 1024)} MB heap used`)
        this.ctx.log(title)
        if (task.result.state === 'fail')
          this.ctx.log(c.red(`   ${F_RIGHT} ${(task.result.error as any)?.message}`))
      }
    }
  }
}
