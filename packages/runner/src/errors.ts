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

export class FixtureAccessError extends Error {
  public name = 'FixtureAccessError'
}

export class FixtureParseError extends Error {
  public name = 'FixtureParseError'
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

// `test.fails` doesn't flip the test result when this error is thrown
export class TestSyntaxError extends Error {
  public name = 'TestSyntaxError'

  constructor(message: string) {
    super(message)
    // use custom property so this survives when the error
    // is serialized on `packages/expect` side (e.g. for `expect.soft`)
    // and `packages/runner` can still detect it during `test.fails` handling
    Object.defineProperty(this, '__vitest_test_syntax_error__', {
      value: true,
      enumerable: false,
    })
  }
}
