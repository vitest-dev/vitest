import type { Vitest } from '../../node'
import { flattenTasks } from '../../utils'
import { TapReporter } from './tap'

export class TapFlatReporter extends TapReporter {
  onInit(ctx: Vitest): void {
    super.onInit(ctx)
  }

  async onFinished(files = this.ctx.state.getFiles()) {
    this.ctx.log('TAP version 13')

    const flatTasks = files.flatMap(task => flattenTasks(task))

    this.logTasks(flatTasks)
  }
}
