import type { Awaitable } from '../types'
import { getWorkerState } from '../utils'

const filesCount = new Map<string, number>()
const cache = new Map<string, any>()

/**
 * This utils allows computational intensive tasks to only be ran once
 * across test reruns to improve the watch mode performance.
 *
 * Currently only works with `isolate: false`
 *
 * @experimental
 */
export async function runOnce<T>(fn: (() => Awaitable<T>), key?: string): Promise<T> {
  if (!key) {
    const filepath = getWorkerState().filepath || '__unknown_files__'
    filesCount.set(filepath, (filesCount.get(filepath) || 0) + 1)
    const count = filesCount.get(filepath)!
    key = `${filepath}:${count}`
  }

  if (!cache.has(key))
    cache.set(key, fn())

  return await cache.get(key)
}

/**
 * @internal
 */
export function resetRunOnceCounter() {
  filesCount.clear()
}
