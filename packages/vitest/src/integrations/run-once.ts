import { getWorkerState } from '../runtime/utils'

const filesCount = new Map<string, number>()
const cache = new Map<string, any>()

/**
 * This utils allows computational intensive tasks to only be ran once
 * across test reruns to improve the watch mode performance.
 *
 * Currently only works with `poolOptions.<pool>.isolate: false`
 *
 * @experimental
 */
export function runOnce<T>(fn: () => T, key?: string): T {
  const filepath = getWorkerState().filepath || '__unknown_files__'

  if (!key) {
    filesCount.set(filepath, (filesCount.get(filepath) || 0) + 1)
    key = String(filesCount.get(filepath)!)
  }

  const id = `${filepath}:${key}`

  if (!cache.has(id)) {
    cache.set(id, fn())
  }

  return cache.get(id)
}

/**
 * Get a boolean indicates whether the task is running in the first time.
 * Could only be `false` in watch mode.
 *
 * Currently only works with `isolate: false`
 *
 * @experimental
 */
export function isFirstRun() {
  let firstRun = false
  runOnce(() => {
    firstRun = true
  }, '__vitest_first_run__')
  return firstRun
}

/**
 * @internal
 */
export function resetRunOnceCounter() {
  filesCount.clear()
}
