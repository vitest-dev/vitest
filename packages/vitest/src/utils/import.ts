import { getWorkerState } from './global'
import { getSafeTimers } from './timers'

function waitNextTick() {
  const { setTimeout } = getSafeTimers()
  return new Promise(resolve => setTimeout(resolve, 0))
}

export async function waitForImportsToResolve() {
  await waitNextTick()
  const state = getWorkerState()
  const promises: Promise<unknown>[] = []
  let resolvingCount = 0
  for (const mod of state.moduleCache.values()) {
    if (mod.promise && !mod.evaluated)
      promises.push(mod.promise)
    if (mod.resolving)
      resolvingCount++
  }
  if (!promises.length && !resolvingCount)
    return
  await Promise.allSettled(promises)
  await waitForImportsToResolve()
}
