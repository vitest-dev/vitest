import type { Awaitable } from '@vitest/utils'
import type { RuntimeContext, SuiteCollector, Test, TestAnnotation, TestContext, VitestRunner, WriteableTestContext } from './types'
import { getSafeTimers } from '@vitest/utils/timers'
import { manageArtifactAttachment, recordArtifact, recordAsyncOperation } from './artifact'
import { PendingError } from './errors'
import { finishSendTasksUpdate } from './run'
import { getRunner } from './suite'
import { getRunningTests } from './test-state'

const now = globalThis.performance
  ? globalThis.performance.now.bind(globalThis.performance)
  : Date.now

/**
 * Buffer (ms) subtracted from the remaining test/hook budget so that a clamped
 * operation fails *before* the test timer, producing a descriptive error.
 */
export const TIMEOUT_BUFFER = 300

/**
 * Fixed timeout (ms) used for `'auto'` operations when there is no test budget
 * to ride (outside a test, or the budget is disabled).
 */
export const AUTO_TIMEOUT_FALLBACK = 1000

/**
 * The remaining budget of the currently-executing test or hook, or `undefined`
 * when it can't be determined: outside a test/hook, when the budget is disabled
 * (`0`/`Infinity`), or when more than one test is running concurrently (the
 * singleton start/timeout is then ambiguous, so we fall back instead of guessing).
 */
export function getCurrentBudget(): { startTime: number; timeout: number } | undefined {
  const runner = getRunner()
  const startTime = runner._currentTaskStartTime
  const timeout = runner._currentTaskTimeout
  if (startTime == null || timeout == null || timeout <= 0 || timeout === Number.POSITIVE_INFINITY) {
    return undefined
  }
  if (getRunningTests().length > 1) {
    return undefined
  }
  return { startTime, timeout }
}

/**
 * Clamp a desired timeout to the remaining test/hook budget (minus a buffer).
 * `desired === undefined` means "no own cap" (`'auto'`) — ride the budget.
 * Returns `undefined` only when there is no budget *and* no desired cap; the
 * caller then applies {@link AUTO_TIMEOUT_FALLBACK}.
 */
export function clampToBudget(desired: number | undefined): number | undefined {
  const budget = getCurrentBudget()
  if (!budget) {
    return desired
  }
  const remaining = Math.max(Math.floor(budget.startTime + budget.timeout - now()) - TIMEOUT_BUFFER, 1)
  if (desired == null) {
    return remaining
  }
  return Math.min(desired, remaining)
}

/**
 * Split a `number | 'auto' | { timeout?, interval? }` config value into its
 * timeout and interval parts.
 */
export function normalizeTimeoutConfig(
  value: number | 'auto' | { timeout?: number | 'auto'; interval?: number } | undefined,
): { timeout: number | 'auto' | undefined; interval: number | undefined } {
  if (value == null) {
    return { timeout: undefined, interval: undefined }
  }
  if (typeof value === 'object') {
    return { timeout: value.timeout, interval: value.interval }
  }
  return { timeout: value, interval: undefined }
}

export interface BudgetedTimeout {
  /** The effective timeout to use (ms). */
  timeout: number
  /** The configured/per-call cap before clamping, or `undefined` for `'auto'`. */
  requested: number | undefined
  /** `true` when the remaining test budget (not the requested cap) set the timeout. */
  clampedByBudget: boolean
}

/**
 * Resolve an effective timeout for a budget-clamped operation from a config
 * value (`number | 'auto'`) and an optional per-call override. Per-call wins as
 * the cap; `'auto'` rides the budget; with no budget and no cap, falls back to
 * {@link AUTO_TIMEOUT_FALLBACK}.
 */
export function resolveBudgetedTimeout(
  perCall: number | undefined,
  configValue: number | 'auto' | undefined,
): BudgetedTimeout {
  const cap = perCall ?? (configValue === 'auto' ? undefined : configValue)
  const budget = getCurrentBudget()
  if (!budget) {
    return { timeout: cap ?? AUTO_TIMEOUT_FALLBACK, requested: cap, clampedByBudget: false }
  }
  const remaining = Math.max(Math.floor(budget.startTime + budget.timeout - now()) - TIMEOUT_BUFFER, 1)
  if (cap == null) {
    return { timeout: remaining, requested: undefined, clampedByBudget: true }
  }
  return { timeout: Math.min(cap, remaining), requested: cap, clampedByBudget: remaining < cap }
}

/**
 * Human-readable timeout description for error messages, noting when the
 * effective timeout was capped by the remaining test budget. `setting` is the
 * config path that controls it, e.g. `test.timeout.poll`.
 */
export function describeBudgetedTimeout(resolved: BudgetedTimeout, setting: string): string {
  if (resolved.clampedByBudget) {
    const configured = resolved.requested != null
      ? `configured ${setting}: ${resolved.requested}ms`
      : `${setting}: 'auto'`
    return `${resolved.timeout}ms (capped by the remaining test time; ${configured})`
  }
  return `${resolved.timeout}ms (${setting})`
}

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
  onTimeout?: (args: T extends (...args: infer A) => any ? A : never, error: Error) => void,
): T {
  if (timeout <= 0 || timeout === Number.POSITIVE_INFINITY) {
    return fn
  }

  const { setTimeout, clearTimeout } = getSafeTimers()

  // this function name is used to filter error in test/e2e/test/fails.test.ts
  return (function runWithTimeout(...args: T extends (...args: infer A) => any ? A : never) {
    const startTime = now()
    const runner = getRunner()
    runner._currentTaskStartTime = startTime
    runner._currentTaskTimeout = timeout
    return new Promise((resolve_, reject_) => {
      const timer = setTimeout(() => {
        clearTimeout(timer)
        rejectTimeoutError()
      }, timeout)
      // `unref` might not exist in browser
      timer.unref?.()

      function rejectTimeoutError() {
        const error = makeTimeoutError(isHook, timeout, stackTraceError)
        onTimeout?.(args, error)
        reject_(error)
      }

      function resolve(result: unknown) {
        runner._currentTaskStartTime = undefined
        runner._currentTaskTimeout = undefined
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
        runner._currentTaskStartTime = undefined
        runner._currentTaskTimeout = undefined
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

export function withCancel<T extends (...args: any[]) => any>(
  fn: T,
  signal: AbortSignal,
): T {
  return (function runWithCancel(...args: T extends (...args: infer A) => any ? A : never) {
    return new Promise((resolve, reject) => {
      const onAbort = () => reject(signal.reason)
      signal.addEventListener('abort', onAbort, { once: true })

      const cleanup = () => signal.removeEventListener('abort', onAbort)

      try {
        const result = fn(...args) as PromiseLike<unknown>

        if (typeof result === 'object' && result != null && typeof result.then === 'function') {
          result.then(
            (value) => {
              cleanup()
              resolve(value)
            },
            (error) => {
              cleanup()
              reject(error)
            },
          )
        }
        else {
          cleanup()
          resolve(result)
        }
      }
      catch (error) {
        cleanup()
        reject(error)
      }
    })
  }) as T
}

const abortControllers = new WeakMap<TestContext, AbortController>()

export function abortIfTimeout([context]: [TestContext?, unknown?], error: Error): void {
  if (context) {
    abortContextSignal(context, error)
  }
}

export function abortContextSignal(context: TestContext, error: Error): void {
  const abortController = abortControllers.get(context)
  abortController?.abort(error)
}

export function createTestContext(
  test: Test,
  runner: VitestRunner,
): TestContext {
  const context = function () {
    throw new Error('done() callback is deprecated, use promise instead')
  } as unknown as WriteableTestContext

  let abortController = abortControllers.get(context)

  if (!abortController) {
    abortController = new AbortController()
    abortControllers.set(context, abortController)
  }

  context.signal = abortController.signal
  context.task = test

  context.skip = (condition?: boolean | string, note?: string): never => {
    if (condition === false) {
      // do nothing
      return undefined as never
    }
    test.result ??= { state: 'skip' }
    test.result.pending = true
    throw new PendingError(
      'test is skipped; abort execution',
      test,
      typeof condition === 'string' ? condition : note,
    )
  }

  context.annotate = ((message, type, attachment) => {
    if (test.result && test.result.state !== 'run') {
      throw new Error(`Cannot annotate tests outside of the test run. The test "${test.name}" finished running with the "${test.result.state}" state already.`)
    }

    const annotation: TestAnnotation = {
      message,
      type: typeof type === 'object' || type === undefined ? 'notice' : type,
    }
    const annotationAttachment = typeof type === 'object' ? type : attachment

    if (annotationAttachment) {
      annotation.attachment = annotationAttachment

      manageArtifactAttachment(annotation.attachment)
    }

    return recordAsyncOperation(
      test,
      recordArtifact(test, { type: 'internal:annotation', annotation }).then(async ({ annotation }) => {
        if (!runner.onTestAnnotate) {
          throw new Error(`Test runner doesn't support test annotations.`)
        }

        await finishSendTasksUpdate(runner)

        const resolvedAnnotation = await runner.onTestAnnotate(test, annotation)
        test.annotations.push(resolvedAnnotation)
        return resolvedAnnotation
      }),
    )
  }) as TestContext['annotate']

  context.onTestFailed = (handler, timeout) => {
    test.onFailed ||= []
    test.onFailed.push(
      withTimeout(
        handler,
        timeout ?? runner.config.hookTimeout,
        true,
        new Error('STACK_TRACE_ERROR'),
        (_, error) => abortController.abort(error),
      ),
    )
  }

  context.onTestFinished = (handler, timeout) => {
    test.onFinished ||= []
    test.onFinished.push(
      withTimeout(
        handler,
        timeout ?? runner.config.hookTimeout,
        true,
        new Error('STACK_TRACE_ERROR'),
        (_, error) => abortController.abort(error),
      ),
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
    isHook ? 'timeout.hook' : 'timeout.test'
  }".`
  const error = new Error(message)
  if (stackTraceError?.stack) {
    error.stack = stackTraceError.stack.replace(error.message, stackTraceError.message)
  }
  return error
}
