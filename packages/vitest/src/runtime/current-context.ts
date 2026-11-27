import type { CurrentContext } from './runner/test-state'
import { AsyncLocalStorage } from 'node:async_hooks'

// before Node 24, AsyncLocalStorage relies on promise hooks that slow down every promise
const supported = Number(process.versions.node.split('.')[0]) >= 24

// only the worker imports this, so a vm pool keeps one instance;
// the runner gets it from the worker state
let currentContext: AsyncLocalStorage<CurrentContext> | undefined

export function getCurrentContext(): AsyncLocalStorage<CurrentContext> | undefined {
  if (supported) {
    currentContext ??= new AsyncLocalStorage<CurrentContext>()
  }
  return currentContext
}
