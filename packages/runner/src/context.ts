import type { Awaitable } from '@vitest/utils'
import type { VitestRunner } from './types/runner'
import type {
  RuntimeContext,
  SuiteCollector,
  Test,
  TestContext,
} from './types/tasks'
import { getSafeTimers } from '@vitest/utils'
import { PendingError } from './errors'

const now = Date.now

export const collectorContext: RuntimeContext = {
  tasks: [],
  currentSuite: null,
}

export function collectTask(task: SuiteCollector): void {
  collectorContext.currentSuite?.tasks.push(task)
}

export async function runWithSuite(
  suite: SuiteCollector,
  fn: () => Awaitable<void>,
): Promise<void> {
  const prev = collectorContext.currentSuite
  collectorContext.currentSuite = suite
  await fn()
  collectorContext.currentSuite = prev
}

export function withTimeout<T extends (...args: any[]) => any>(
  fn: T,
  timeout: number,
  isHook = false,
  stackTraceError?: Error,
): T {
  if (timeout <= 0 || timeout === Number.POSITIVE_INFINITY) {
    return fn
  }

  const { setTimeout, clearTimeout } = getSafeTimers()

  // this function name is used to filter error in test/cli/test/fails.test.ts
  return (function runWithTimeout(...args: T extends (...args: infer A) => any ? A : never) {
    const startTime = now()
    return new Promise((resolve_, reject_) => {
      const timer = setTimeout(() => {
        clearTimeout(timer)
        rejectTimeoutError()
      }, timeout)
      // `unref` might not exist in browser
      timer.unref?.()

      function rejectTimeoutError() {
        reject_(makeTimeoutError(isHook, timeout, stackTraceError))
      }

      function resolve(result: unknown) {
        clearTimeout(timer)
        // if test/hook took too long in microtask, setTimeout won't be triggered,
        // but we still need to fail the test, see
        // https://github.com/vitest-dev/vitest/issues/2920
        if (now() - startTime >= timeout) {
          rejectTimeoutError()
          return
        }
        resolve_(result)
      }

      function reject(error: unknown) {
        clearTimeout(timer)
        reject_(error)
      }

      // sync test/hook will be caught by try/catch
      try {
        const result = fn(...args) as PromiseLike<unknown>
        // the result is a thenable, we don't wrap this in Promise.resolve
        // to avoid creating new promises
        if (typeof result === 'object' && result != null && typeof result.then === 'function') {
          result.then(resolve, reject)
        }
        else {
          resolve(result)
        }
      }
      // user sync test/hook throws an error
      catch (error) {
        reject(error)
      }
    })
  }) as T
}

export function createTestContext(
  test: Test,
  runner: VitestRunner,
): TestContext {
  const context = function () {
    throw new Error('done() callback is deprecated, use promise instead')
  } as unknown as TestContext

  context.task = test

  context.skip = (note?: string) => {
    test.result ??= { state: 'skip' }
    test.result.pending = true
    throw new PendingError('test is skipped; abort execution', test, note)
  }

  context.onTestFailed = (handler, timeout) => {
    test.onFailed ||= []
    test.onFailed.push(
      withTimeout(handler, timeout ?? runner.config.hookTimeout, true, new Error('STACK_TRACE_ERROR')),
    )
  }

  context.onTestFinished = (handler, timeout) => {
    test.onFinished ||= []
    test.onFinished.push(
      withTimeout(handler, timeout ?? runner.config.hookTimeout, true, new Error('STACK_TRACE_ERROR')),
    )
  }

  return runner.extendTaskContext?.(context) || context
}

function makeTimeoutError(isHook: boolean, timeout: number, stackTraceError?: Error) {
  const message = `${
    isHook ? 'Hook' : 'Test'
  } timed out in ${timeout}ms.\nIf this is a long-running ${
    isHook ? 'hook' : 'test'
  }, pass a timeout value as the last argument or configure it globally with "${
    isHook ? 'hookTimeout' : 'testTimeout'
  }".`
  const error = new Error(message)
  if (stackTraceError?.stack) {
    error.stack = stackTraceError.stack.replace(error.message, stackTraceError.message)
  }
  return error
}
