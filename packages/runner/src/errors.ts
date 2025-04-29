import type { TaskBase } from './types/tasks'

export class PendingError extends Error {
  public code = 'VITEST_PENDING'
  public taskId: string

  constructor(public message: string, task: TaskBase, public note: string | undefined) {
    super(message)
    this.taskId = task.id
  }
}

export class AbortError extends Error {
  name = 'AbortError'
  // 20 is the legacy error code for AbortError
  // https://developer.mozilla.org/en-US/docs/Web/API/DOMException#error_names
  code = 20
}
