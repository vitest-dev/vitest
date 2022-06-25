import type { DoneCallback } from '../types'

/**
 * A simple wrapper for converting callback style to promise
 */
export function withCallback(fn: (done: DoneCallback) => void): Promise<void> {
  return new Promise((resolve, reject) =>
    fn((err) => {
      if (err)
        reject(err)
      else
        resolve()
    }),
  )
}
