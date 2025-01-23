import type { Debugger } from 'debug'
import createDebug from 'debug'

export function createDebugger(namespace: `vitest:${string}`): Debugger | undefined {
  const debug = createDebug(namespace)
  if (debug.enabled) {
    return debug
  }
}
