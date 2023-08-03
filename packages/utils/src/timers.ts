import { SAFE_TIMERS_SYMBOL } from './constants'

export function getSafeTimers() {
  const {
    setTimeout: safeSetTimeout,
    setInterval: safeSetInterval,
    clearInterval: safeClearInterval,
    clearTimeout: safeClearTimeout,
    setImmediate: safeSetImmediate,
    clearImmediate: safeClearImmediate,
    queueMicrotask: safeQueueMicrotask,
  } = (globalThis as any)[SAFE_TIMERS_SYMBOL] || globalThis

  const {
    nextTick: safeNextTick,
    hrtime: safeHrtime,
  } = (globalThis as any)[SAFE_TIMERS_SYMBOL] || globalThis.process || { nextTick: (cb: () => void) => cb() }

  return {
    queueMicrotask: safeQueueMicrotask,
    hrtime: safeHrtime,
    nextTick: safeNextTick,
    setTimeout: safeSetTimeout,
    setInterval: safeSetInterval,
    clearInterval: safeClearInterval,
    clearTimeout: safeClearTimeout,
    setImmediate: safeSetImmediate,
    clearImmediate: safeClearImmediate,
  }
}

export function setSafeTimers() {
  if ((globalThis as any)[SAFE_TIMERS_SYMBOL])
    return

  const {
    setTimeout: safeSetTimeout,
    setInterval: safeSetInterval,
    clearInterval: safeClearInterval,
    clearTimeout: safeClearTimeout,
    setImmediate: safeSetImmediate,
    clearImmediate: safeClearImmediate,
    queueMicrotask: safeQueueMicrotask,
  } = globalThis

  const {
    nextTick: safeNextTick,
    hrtime: safeHrtime,
  } = globalThis.process || { nextTick: cb => cb(), hrtime: () => [0, 0] }

  const timers = {
    queueMicrotask: safeQueueMicrotask,
    nextTick: safeNextTick,
    hrtime: safeHrtime,
    setTimeout: safeSetTimeout,
    setInterval: safeSetInterval,
    clearInterval: safeClearInterval,
    clearTimeout: safeClearTimeout,
    setImmediate: safeSetImmediate,
    clearImmediate: safeClearImmediate,
  }

  ;(globalThis as any)[SAFE_TIMERS_SYMBOL] = timers
}
