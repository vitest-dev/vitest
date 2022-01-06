import type { Vitest } from '../node'
import type { Task } from '../types'
import { TapReporter } from './tap'

function flattenTasks(task: Task, baseName = ''): Task[] {
  const base = baseName ? `${baseName} > ` : ''

  if (task.type === 'suite' && task.tasks.length > 0) {
    return task.tasks.flatMap(child => flattenTasks(child, `${base}${task.name}`))
  }
  else {
    return [{
      ...task,
      name: `${base}${task.name}`,
    }]
  }
}

export class TapFlatReporter extends TapReporter {
  onInit(ctx: Vitest): void {
    super.onInit(ctx)
  }

  async onFinished(files = this.ctx.state.getFiles()) {
    this.ctx.log('TAP version 13')

    const flatTasks = files
      .flatMap(task => flattenTasks(task))

    this.logTasks(flatTasks, '')
  }
}
