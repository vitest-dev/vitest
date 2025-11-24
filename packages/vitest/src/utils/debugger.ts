import type { Debugger } from 'obug'
import { createDebug } from 'obug'

export function createDebugger(namespace: `vitest:${string}`): Debugger | undefined {
  const debug = createDebug(namespace)
  if (debug.enabled) {
    return debug
  }
}
