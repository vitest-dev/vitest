import { getSafeTimers } from '@vitest/utils'

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
}

function copyStackTrace(target: Error, source: Error) {
  if (source.stack !== undefined)
    target.stack = source.stack.replace(source.message, target.message)
  return target
}

export function waitFor<T>(callback: WaitForCallback<T>, options: number | WaitForOptions = {}) {
  const { setTimeout, setInterval, clearTimeout, clearInterval } = getSafeTimers()
  const { interval = 50, timeout = 1000 } = typeof options === 'number' ? { timeout: options } : options
  const STACK_TRACE_ERROR = new Error('STACK_TRACE_ERROR')

  return new Promise<T>((resolve, reject) => {
    let lastError: unknown
    let promiseStatus: 'idle' | 'pending' | 'resolved' | 'rejected' = 'idle'
    let timeoutId: ReturnType<typeof setTimeout>
    let intervalId: ReturnType<typeof setInterval>

    const onResolve = (result: T) => {
      if (timeoutId)
        clearTimeout(timeoutId)
      if (intervalId)
        clearInterval(intervalId)

      resolve(result)
    }

    const handleTimeout = () => {
      let error = lastError
      if (!error)
        error = copyStackTrace(new Error('Timed out in waitFor!'), STACK_TRACE_ERROR)

      reject(error)
    }

    const checkCallback = () => {
      if (promiseStatus === 'pending')
        return
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

    if (checkCallback() === true)
      return

    timeoutId = setTimeout(handleTimeout, timeout)
    intervalId = setInterval(checkCallback, interval)
  })
}
