import type { TaskBase } from './types/tasks'

export class PendingError extends Error {
  public code = 'VITEST_PENDING'
  public taskId: string

  constructor(public message: string, task: TaskBase, public note: string | undefined) {
    super(message)
    this.taskId = task.id
  }
}
