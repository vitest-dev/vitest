import type { Task } from '@vitest/runner'
import type { Vitest } from '../core'
import type { TestModule } from './reported-tasks'
import { TapReporter } from './tap'

function flattenTasks(task: Task, baseName = ''): Task[] {
  const base = baseName ? `${baseName} > ` : ''

  if (task.type === 'suite' && task.tasks.length > 0) {
    return task.tasks.flatMap(child =>
      flattenTasks(child, `${base}${task.name}`),
    )
  }
  else {
    return [
      {
        ...task,
        name: `${base}${task.name}`,
      },
    ]
  }
}

export class TapFlatReporter extends TapReporter {
  onInit(ctx: Vitest): void {
    super.onInit(ctx)
  }

  onTestRunEnd(testModules: ReadonlyArray<TestModule>): void {
    this.ctx.logger.log('TAP version 13')

    const flatTasks = testModules.flatMap(testModule => flattenTasks(testModule.task))

    this.logTasks(flatTasks)
  }
}
