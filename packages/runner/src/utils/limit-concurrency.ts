// A compact (code-wise, probably not memory-wise) singly linked list node.
type QueueNode<T> = [value: T, next?: QueueNode<T>]

export interface ConcurrencyLimiter extends RunWithLimit {
  acquire: () => (() => void) | Promise<() => void>
}

type RunWithLimit = <Args extends unknown[], T>(func: (...args: Args) => PromiseLike<T> | T, ...args: Args) => Promise<T>

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

  const runWithLimit: RunWithLimit = (func, ...args) => {
    const release = acquire()

    if (release instanceof Promise) {
      return release.then(() => func(...args)).finally(finish)
    }

    return promiseTry(func, ...args).finally(finish)
  }

  return Object.assign(runWithLimit, { acquire })
}

// Promise.try ponyfill
function promiseTry<TArgs extends unknown[], T>(
  fn: (...args: TArgs) => T | PromiseLike<T>,
  ...args: TArgs
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    try {
      resolve(fn(...args))
    }
    catch (error) {
      reject(error)
    }
  })
}
