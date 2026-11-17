import type { CurrentContext, CurrentContextStore } from './runner/test-state'
import { AsyncLocalStorage } from 'node:async_hooks'

// TODO: make the context opt-in and create it lazily only when enabled, because on Node 22 it slows down every promise
const currentContext = new AsyncLocalStorage<CurrentContext>()
export const currentContextStore: CurrentContextStore = {
  run: (context, fn) => currentContext.run(context, fn),
  get: () => currentContext.getStore(),
}
