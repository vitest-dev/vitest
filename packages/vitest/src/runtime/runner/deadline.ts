import { getSafeTimers } from '@vitest/utils/timers'

const now = globalThis.performance
  ? globalThis.performance.now.bind(globalThis.performance)
  : Date.now

// makes an operation deadline derived from the task fire before the task timer
const DERIVED_BUFFER = 100
// how long the task timer waits for a tracked operation past that operation's own deadline
const SETTLE_GRACE = 500

interface TrackedOperation {
  name: string
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
  track<T>(name: string, promise: Promise<T>, timeout: number): Promise<T> {
    const operation = { name, promise, endTime: now() + timeout }
    this.operations.add(operation)
    promise.finally(() => this.operations.delete(operation)).catch(() => {})
    return promise
  }

  /**
   * Waits for the operations that were due before the task. Rejects with the
   * error of the first one that failed, otherwise resolves with the names of
   * the ones that did not report back in time.
   */
  settle(): Promise<string[]> | undefined {
    const operations = [...this.operations].filter(operation => operation.endTime <= this.endTime)
    if (!operations.length) {
      return undefined
    }
    const { setTimeout } = getSafeTimers()
    const waitUntil = Math.max(...operations.map(operation => operation.endTime)) + SETTLE_GRACE
    return Promise.race([
      Promise.all(operations.map(operation => operation.promise)).then(() => []),
      new Promise<string[]>(resolve => setTimeout(() => {
        resolve(operations.filter(operation => this.operations.has(operation)).map(operation => operation.name))
      }, Math.max(waitUntil - now(), 0))),
    ])
  }
}
