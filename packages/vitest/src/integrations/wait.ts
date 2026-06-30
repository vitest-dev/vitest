import { getSafeTimers } from '@vitest/utils/timers'
import { DEFAULT_POLL_INTERVALS, describeBudgetedTimeout, intervalForAttempt, resolveBudgetedTimeout } from '../runtime/runner/context'
import { getWorkerState } from '../runtime/utils'
import { vi } from './vi'

// The waitFor function was inspired by https://github.com/testing-library/web-testing-library/pull/2

export type WaitForCallback<T> = () => T | Promise<T>

function resolveWaitOptions(options: number | WaitForOptions): { intervals: number[]; timeout: number; timeoutDescription: string } {
  const userOptions = typeof options === 'number' ? { timeout: options } : options
  // `'auto'` rides the remaining test/hook budget; a number caps below it; a
  // per-call timeout wins but is still clamped to the budget.
  const resolved = resolveBudgetedTimeout(userOptions.timeout, getWorkerState().config.timeout?.wait)
  return {
    intervals: userOptions.intervals ?? DEFAULT_POLL_INTERVALS,
    timeout: resolved.timeout,
    timeoutDescription: describeBudgetedTimeout(resolved, 'test.timeout.wait'),
  }
}

export interface WaitForOptions {
  /**
   * @description Ascending poll backoff in ms between checks; the last value
   * repeats for further attempts.
   * @default [0, 25, 50, 100, 250, 500]
   */
  intervals?: number[]
  /**
   * @description Time in ms after which the throw a timeout error
   * @default 1000ms
   */
  timeout?: number
}

function copyStackTrace(target: Error, source: Error) {
  if (source.stack !== undefined) {
    target.stack = source.stack.replace(source.message, target.message)
  }
  return target
}

export function waitFor<T>(
  callback: WaitForCallback<T>,
  options: number | WaitForOptions = {},
): Promise<T> {
  const { setTimeout, clearTimeout } = getSafeTimers()
  const { intervals, timeout, timeoutDescription } = resolveWaitOptions(options)
  const STACK_TRACE_ERROR = new Error('STACK_TRACE_ERROR')

  return new Promise<T>((resolve, reject) => {
    let lastError: unknown
    let promiseStatus: 'idle' | 'pending' | 'resolved' | 'rejected' = 'idle'
    let settled = false
    let attempt = 0
    let timeoutId: ReturnType<typeof setTimeout> | undefined
    let nextId: ReturnType<typeof setTimeout> | undefined

    const cleanup = () => {
      settled = true
      if (timeoutId) {
        clearTimeout(timeoutId)
      }
      if (nextId) {
        clearTimeout(nextId)
      }
    }

    const onResolve = (result: T) => {
      cleanup()
      resolve(result)
    }

    const handleTimeout = () => {
      cleanup()
      let error = lastError
      if (!error) {
        error = copyStackTrace(
          new Error(`Timed out in waitFor! Timed out in ${timeoutDescription}.`),
          STACK_TRACE_ERROR,
        )
      }

      reject(error)
    }

    const checkCallback = (advanceBy: number) => {
      if (vi.isFakeTimers()) {
        vi.advanceTimersByTime(advanceBy)
      }

      if (promiseStatus === 'pending') {
        return
      }
      try {
        const result = callback()
        if (
          result !== null
          && typeof result === 'object'
          && typeof (result as any).then === 'function'
        ) {
          const thenable = result as PromiseLike<T>
          promiseStatus = 'pending'
          thenable.then(
            (resolvedValue) => {
              promiseStatus = 'resolved'
              onResolve(resolvedValue)
            },
            (rejectedValue) => {
              promiseStatus = 'rejected'
              lastError = rejectedValue
            },
          )
        }
        else {
          onResolve(result as T)
          return true
        }
      }
      catch (error) {
        lastError = error
      }
    }

    const scheduleNext = () => {
      const interval = intervalForAttempt(intervals, attempt++)
      nextId = setTimeout(() => {
        checkCallback(interval)
        if (!settled) {
          scheduleNext()
        }
      }, interval)
    }

    if (checkCallback(0) === true) {
      return
    }

    timeoutId = setTimeout(handleTimeout, timeout)
    scheduleNext()
  })
}

export type WaitUntilCallback<T> = () => T | Promise<T>

export interface WaitUntilOptions
  extends Pick<WaitForOptions, 'intervals' | 'timeout'> {}

type Truthy<T> = T extends false | '' | 0 | null | undefined ? never : T

export function waitUntil<T>(
  callback: WaitUntilCallback<T>,
  options: number | WaitUntilOptions = {},
): Promise<Truthy<T>> {
  const { setTimeout, clearTimeout } = getSafeTimers()
  const { intervals, timeout, timeoutDescription } = resolveWaitOptions(options)
  const STACK_TRACE_ERROR = new Error('STACK_TRACE_ERROR')

  return new Promise<Truthy<T>>((resolve, reject) => {
    let promiseStatus: 'idle' | 'pending' | 'resolved' | 'rejected' = 'idle'
    let settled = false
    let attempt = 0
    let timeoutId: ReturnType<typeof setTimeout> | undefined
    let nextId: ReturnType<typeof setTimeout> | undefined

    const cleanup = () => {
      settled = true
      if (timeoutId) {
        clearTimeout(timeoutId)
      }
      if (nextId) {
        clearTimeout(nextId)
      }
    }

    const onReject = (error?: Error) => {
      cleanup()
      if (!error) {
        error = copyStackTrace(
          new Error(`Timed out in waitUntil! Timed out in ${timeoutDescription}.`),
          STACK_TRACE_ERROR,
        )
      }
      reject(error)
    }

    const onResolve = (result: T) => {
      if (!result) {
        return
      }
      cleanup()
      resolve(result as Truthy<T>)
      return true
    }

    const checkCallback = (advanceBy: number) => {
      if (vi.isFakeTimers()) {
        vi.advanceTimersByTime(advanceBy)
      }

      if (promiseStatus === 'pending') {
        return
      }
      try {
        const result = callback()
        if (
          result !== null
          && typeof result === 'object'
          && typeof (result as any).then === 'function'
        ) {
          const thenable = result as PromiseLike<T>
          promiseStatus = 'pending'
          thenable.then(
            (resolvedValue) => {
              promiseStatus = 'resolved'
              onResolve(resolvedValue)
            },
            (rejectedValue) => {
              promiseStatus = 'rejected'
              onReject(rejectedValue)
            },
          )
        }
        else {
          return onResolve(result as T)
        }
      }
      catch (error) {
        onReject(error as Error)
      }
    }

    const scheduleNext = () => {
      const interval = intervalForAttempt(intervals, attempt++)
      nextId = setTimeout(() => {
        checkCallback(interval)
        if (!settled) {
          scheduleNext()
        }
      }, interval)
    }

    if (checkCallback(0) === true) {
      return
    }

    timeoutId = setTimeout(onReject, timeout)
    scheduleNext()
  })
}
