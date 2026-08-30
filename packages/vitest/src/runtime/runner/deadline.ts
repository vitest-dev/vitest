import { getSafeTimers } from '@vitest/utils/timers'

const now = globalThis.performance
  ? globalThis.performance.now.bind(globalThis.performance)
  : Date.now

// makes an operation deadline derived from the task fire before the task timer
const DERIVED_BUFFER = 100
// how long the task timer waits for a tracked operation past that operation's own deadline
const SETTLE_GRACE = 500

export interface PendingOperation {
  name: string
  /** error created where the operation was called, used for the timeout stack trace */
  source?: Error
}

interface TrackedOperation extends PendingOperation {
  promise: Promise<unknown>
  endTime: number
}

export class TaskDeadline {
  public readonly startTime: number = now()
  public readonly endTime: number
  private timer: ReturnType<typeof setTimeout>
  private operations = new Set<TrackedOperation>()

  constructor(timeout: number, onTimeout: () => void) {
    this.endTime = this.startTime + timeout
    const { setTimeout } = getSafeTimers()
    this.timer = setTimeout(onTimeout, timeout)
    // `unref` might not exist in browser
    this.timer.unref?.()
  }

  remaining(): number {
    return this.endTime - now()
  }

  exceeded(): boolean {
    return now() >= this.endTime
  }

  clear(): void {
    const { clearTimeout } = getSafeTimers()
    clearTimeout(this.timer)
  }

  /** timeout for an operation that must fail before the task does */
  derive(): number {
    return Math.max(Math.floor(this.remaining()) - DERIVED_BUFFER, 1)
  }

  /** Registers an operation with its own timeout; see `settle`. */
  track<T>(name: string, promise: Promise<T>, timeout: number, source?: Error): Promise<T> {
    const operation = { name, source, promise, endTime: now() + timeout }
    this.operations.add(operation)
    promise.finally(() => this.operations.delete(operation)).catch(() => {})
    return promise
  }

  /**
   * Waits for the operations that were due before the task. Rejects with the
   * error of the first one that failed, otherwise resolves with the ones
   * that did not report back in time.
   */
  settle(): Promise<PendingOperation[]> | undefined {
    const operations = [...this.operations].filter(operation => operation.endTime <= this.endTime)
    if (!operations.length) {
      return undefined
    }
    const { setTimeout } = getSafeTimers()
    const waitUntil = Math.max(...operations.map(operation => operation.endTime)) + SETTLE_GRACE
    return Promise.race([
      // wait until all operations resolve (or the first one rejects)
      Promise.all(operations.map(operation => operation.promise)).then(() => []),
      // or resolve after a grace period with the pending actions for the error (500ms)
      new Promise<PendingOperation[]>(resolve => setTimeout(() => {
        resolve(operations.filter(operation => this.operations.has(operation)))
      // the grace may already be in the past
      }, Math.max(waitUntil - now(), 0))),
    ])
  }
}
