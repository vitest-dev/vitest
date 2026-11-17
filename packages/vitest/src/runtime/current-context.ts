import type { CurrentContext } from './runner/test-state'
import { AsyncLocalStorage } from 'node:async_hooks'

// only the worker imports this, so a vm pool keeps one instance;
// the runner gets it from the worker state
let currentContext: AsyncLocalStorage<CurrentContext> | undefined

export function getCurrentContext(): AsyncLocalStorage<CurrentContext> {
  currentContext ??= new AsyncLocalStorage<CurrentContext>()
  return currentContext
}
