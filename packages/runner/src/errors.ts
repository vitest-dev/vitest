import type { TaskBase } from './types'

export class PendingError extends Error {
  public code = 'VITEST_PENDING'
  public taskId: string

  constructor(public message: string, task: TaskBase) {
    super(message)
    this.taskId = task.id
  }
}
