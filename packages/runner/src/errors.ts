import type { CancelReason } from './types/runner'
import type { TaskBase } from './types/tasks'

export class PendingError extends Error {
  public code = 'VITEST_PENDING'
  public taskId: string

  constructor(public message: string, task: TaskBase, public note: string | undefined) {
    super(message)
    this.taskId = task.id
  }
}

export class TestRunAbortError extends Error {
  public name = 'TestRunAbortError'
  public reason: CancelReason
  constructor(message: string, reason: CancelReason) {
    super(message)
    this.reason = reason
  }
}

export class FixtureDependencyError extends Error {
  public name = 'FixtureDependencyError'
}

export class AroundHookSetupError extends Error {
  public name = 'AroundHookSetupError'
}

export class AroundHookTeardownError extends Error {
  public name = 'AroundHookTeardownError'
}

export class AroundHookMultipleCallsError extends Error {
  public name = 'AroundHookMultipleCallsError'
}
