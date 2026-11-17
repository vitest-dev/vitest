import type { CurrentContext } from './runner/test-state'
import { AsyncLocalStorage } from 'node:async_hooks'

let currentContext: AsyncLocalStorage<CurrentContext> | undefined

export function getCurrentContext(): AsyncLocalStorage<CurrentContext> {
  currentContext ??= new AsyncLocalStorage<CurrentContext>()
  return currentContext
}
