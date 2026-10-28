import { getSafeTimers } from '@vitest/utils/timers'
import { startTraceRange } from '../runtime/trace-timeline'
import { vi } from './vi'

// The waitFor function was inspired by https://github.com/testing-library/web-testing-library/pull/2

export type WaitForCallback<T> = () => T | Promise<T>

export interface WaitForOptions {
  /**
   * @description Time in ms between each check callback
   * @default 50ms
   */
  interval?: number
  /**
   * @description Time in ms after which the throw a timeout error
   * @default 1000ms
   */
  timeout?: number
  /**
   * @description Message that describes what is being waited for. It prefixes the error and names the trace step
   */
  message?: string
}

function copyStackTrace(target: Error, source: Error) {
  if (source.stack !== undefined) {
    target.stack = source.stack.replace(source.message, target.message)
  }
  return target
}

function prefixMessage(error: unknown, message: string | undefined) {
  if (message && error instanceof Error) {
    const original = error.message
    try {
      error.message = `${message}: ${original}`
    } catch {
      // message can be read-only, e.g. DOMException
      return error
    }
    if (error.stack !== undefined) {
      error.stack = error.stack.replace(original, error.message)
    }
  }
  return error
}

function getTraceName(name: string, message: string | undefined) {
  return message ? `${name}: ${message}` : name
}

export function waitFor<T>(
  callback: WaitForCallback<T>,
  options: number | WaitForOptions = {},
): Promise<T> {
  const { setTimeout, setInterval, clearTimeout, clearInterval } = getSafeTimers()
  const {
    interval = 50,
    timeout = 1000,
    message,
  } = typeof options === 'number' ? { timeout: options } : options
  const STACK_TRACE_ERROR = new Error('STACK_TRACE_ERROR')
  const trace = startTraceRange(getTraceName('vi.waitFor()', message), STACK_TRACE_ERROR)

  const promise = new Promise<T>((resolve, reject) => {
    let lastError: unknown
    let promiseStatus: 'idle' | 'pending' | 'resolved' | 'rejected' = 'idle'
    let timeoutId: ReturnType<typeof setTimeout>
    let intervalId: ReturnType<typeof setInterval>

    const onResolve = (result: T) => {
      if (timeoutId) {
        clearTimeout(timeoutId)
      }
      if (intervalId) {
        clearInterval(intervalId)
      }

      resolve(result)
    }

    const handleTimeout = () => {
      if (intervalId) {
        clearInterval(intervalId)
      }
      let error = lastError
      if (!error) {
        error = copyStackTrace(new Error('Timed out in waitFor!'), STACK_TRACE_ERROR)
      }

      reject(prefixMessage(error, message))
    }

    const checkCallback = () => {
      if (vi.isFakeTimers()) {
        vi.advanceTimersByTime(interval)
      }

      if (promiseStatus === 'pending') {
        return
      }
      try {
        const result = callback()
        if (
          result !== null &&
          typeof result === 'object' &&
          typeof (result as any).then === 'function'
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
        } else {
          onResolve(result as T)
          return true
        }
      } catch (error) {
        lastError = error
      }
    }

    if (checkCallback() === true) {
      return
    }

    timeoutId = setTimeout(handleTimeout, timeout)
    intervalId = setInterval(checkCallback, interval)
  })
  return trace(promise)
}

export type WaitUntilCallback<T> = () => T | Promise<T>

export interface WaitUntilOptions extends Pick<
  WaitForOptions,
  'interval' | 'timeout' | 'message'
> {}

type Truthy<T> = T extends false | '' | 0 | null | undefined ? never : T

export function waitUntil<T>(
  callback: WaitUntilCallback<T>,
  options: number | WaitUntilOptions = {},
): Promise<Truthy<T>> {
  const { setTimeout, setInterval, clearTimeout, clearInterval } = getSafeTimers()
  const {
    interval = 50,
    timeout = 1000,
    message,
  } = typeof options === 'number' ? { timeout: options } : options
  const STACK_TRACE_ERROR = new Error('STACK_TRACE_ERROR')
  const trace = startTraceRange(getTraceName('vi.waitUntil()', message), STACK_TRACE_ERROR)

  const promise = new Promise<Truthy<T>>((resolve, reject) => {
    let promiseStatus: 'idle' | 'pending' | 'resolved' | 'rejected' = 'idle'
    let timeoutId: ReturnType<typeof setTimeout>
    let intervalId: ReturnType<typeof setInterval>

    const onReject = (error?: Error) => {
      if (intervalId) {
        clearInterval(intervalId)
      }
      if (!error) {
        error = copyStackTrace(new Error('Timed out in waitUntil!'), STACK_TRACE_ERROR)
      }
      reject(prefixMessage(error, message))
    }

    const onResolve = (result: T) => {
      if (!result) {
        return
      }

      if (timeoutId) {
        clearTimeout(timeoutId)
      }
      if (intervalId) {
        clearInterval(intervalId)
      }

      resolve(result as Truthy<T>)
      return true
    }

    const checkCallback = () => {
      if (vi.isFakeTimers()) {
        vi.advanceTimersByTime(interval)
      }

      if (promiseStatus === 'pending') {
        return
      }
      try {
        const result = callback()
        if (
          result !== null &&
          typeof result === 'object' &&
          typeof (result as any).then === 'function'
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
        } else {
          return onResolve(result as T)
        }
      } catch (error) {
        onReject(error as Error)
      }
    }

    if (checkCallback() === true) {
      return
    }

    timeoutId = setTimeout(onReject, timeout)
    intervalId = setInterval(checkCallback, interval)
  })
  return trace(promise)
}
