import { getWorkerState } from './global'
import { setTimeout } from './timers'

export async function waitForImportsToResolve(tries = 0) {
  await new Promise(resolve => setTimeout(resolve, 0))
  const state = getWorkerState()
  const promises: Promise<unknown>[] = []
  for (const mod of state.moduleCache.values()) {
    if (mod.promise && !mod.evaluated)
      promises.push(mod.promise)
  }
  if (!promises.length && tries >= 3)
    return
  await Promise.allSettled(promises)
  // wait until the end of the loop, so `.then` on modules is called,
  // like in import('./example').then(...)
  // also call dynamicImportSettled again in case new imports were added
  await new Promise(resolve => setTimeout(resolve, 1))
    .then(() => Promise.resolve())
    .then(() => waitForImportsToResolve(tries + 1))
}
