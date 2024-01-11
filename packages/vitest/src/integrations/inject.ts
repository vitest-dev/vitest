import type { ProvidedContext } from '../types/general'
import { getWorkerState } from '../utils/global'

/**
 * Gives access to injected context provided from the main thread.
 * This usually returns a value provided by `globalSetup` or an external library.
 */
export function inject<T extends keyof ProvidedContext>(key: T): ProvidedContext[T] {
  const workerState = getWorkerState()
  return workerState.providedContext[key]
}
