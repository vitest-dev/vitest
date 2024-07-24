import type { ProvidedContext } from '../types/general'
import { getWorkerState } from '../runtime/utils'

/**
 * Gives access to injected context provided from the main thread.
 * This usually returns a value provided by `globalSetup` or an external library.
 */
export function inject<T extends keyof ProvidedContext & string>(
  key: T,
): ProvidedContext[T] {
  const workerState = getWorkerState()
  return workerState.providedContext[key] as ProvidedContext[T]
}
