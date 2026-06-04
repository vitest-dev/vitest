// A compact (code-wise, probably not memory-wise) singly linked list node.
type QueueNode<T> = [value: T, next?: QueueNode<T>]

export interface ConcurrencyLimiter extends ConcurrencyLimiterFn {
  acquire: () => (() => void) | Promise<() => void>
}

type ConcurrencyLimiterFn = <Args extends unknown[], T>(func: (...args: Args) => PromiseLike<T> | T, ...args: Args) => Promise<T>

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

  // A bookkeeping function executed whenever a task has been run to completion.
  const finish = () => {
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
    const release = () => {
      if (!released) {
        released = true
        finish()
      }
    }

    if (count++ < concurrency) {
      return release
    }

    return new Promise<() => void>((resolve) => {
      if (tail) {
        // There are pending tasks, so append to the queue.
        tail = tail[1] = [() => resolve(release)]
      }
      else {
        // No other pending tasks, initialize the queue with a new tail and head.
        head = tail = [() => resolve(release)]
      }
    })
  }

  const limiterFn: ConcurrencyLimiterFn = (func, ...args) => {
    function run(release: () => void) {
      try {
        const result = func(...args)
        if (result instanceof Promise) {
          return result.finally(release)
        }
        release()
        return Promise.resolve(result)
      }
      catch (error) {
        release()
        return Promise.reject(error)
      }
    }

    const release = acquire()
    return release instanceof Promise ? release.then(run) : run(release)
  }

  return Object.assign(limiterFn, { acquire })
}
