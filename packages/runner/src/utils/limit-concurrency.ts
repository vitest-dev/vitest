// A compact (code-wise, probably not memory-wise) singly linked list node.
type QueueNode<T> = [value: T, next?: QueueNode<T>]

export interface ConcurrencyLimiter {
  <Args extends unknown[], T>(func: (...args: Args) => PromiseLike<T> | T, ...args: Args): Promise<T>
  acquire: () => (() => void) | Promise<() => void>
}

/**
 * Return a function for running multiple async operations with limited concurrency.
 */
export function limitConcurrency(concurrency: number = Infinity): ConcurrencyLimiter {
  // The number of currently active + pending tasks.
  let count = 0

  // The head and tail of the pending task queue, built using a singly linked list.
  // Both head and tail are initially undefined, signifying an empty queue.
  // They both become undefined again whenever there are no pending tasks.
  let head: undefined | QueueNode<() => void>
  let tail: undefined | QueueNode<() => void>

  const release = () => {
    if (count === 0) {
      return
    }

    count--

    // Check if there are further pending tasks in the queue.
    if (head) {
      // Allow the next pending task to run and pop it from the queue.
      head[0]()
      head = head[1]

      // The head may now be undefined if there are no further pending tasks.
      // In that case, set tail to undefined as well.
      tail = head && tail
    }
  }

  const acquire = () => {
    let released = false
    const releaseIfNeeded = () => {
      if (!released) {
        released = true
        release()
      }
    }

    if (count++ < concurrency) {
      return releaseIfNeeded
    }

    return new Promise<() => void>((resolve) => {
      if (tail) {
        // There are pending tasks, so append to the queue.
        tail = tail[1] = [() => resolve(releaseIfNeeded)]
      }
      else {
        // No other pending tasks, initialize the queue with a new tail and head.
        head = tail = [() => resolve(releaseIfNeeded)]
      }
    })
  }

  const limit: ConcurrencyLimiter = <Args extends unknown[], T>(func: (...args: Args) => PromiseLike<T> | T, ...args: Args) => {
    const runWithRelease = (releaseIfNeeded: () => void): Promise<T> => {
      let result: PromiseLike<T> | T

      try {
        result = func(...args)
      }
      catch (error) {
        releaseIfNeeded()
        return Promise.reject(error)
      }

      if (typeof result === 'object' && result != null && typeof (result as PromiseLike<T>).then === 'function') {
        return Promise.resolve(result).finally(releaseIfNeeded)
      }

      releaseIfNeeded()
      return Promise.resolve(result)
    }

    const acquired = acquire()

    if (typeof acquired === 'function') {
      return runWithRelease(acquired)
    }

    return acquired.then(runWithRelease)
  }

  limit.acquire = acquire

  return limit
}
