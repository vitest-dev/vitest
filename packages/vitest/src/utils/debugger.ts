import createDebug from 'debug'

export function createDebugger(namespace: `vitest:${string}`) {
  const debug = createDebug(namespace)
  if (debug.enabled) {
    return debug
  }
}
