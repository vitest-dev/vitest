import { SAFE_TIMERS_SYMBOL } from './constants'

let timersSafe = false

export function getSafeTimers() {
  const {
    setTimeout: safeSetTimeout,
    setInterval: safeSetInterval,
    clearInterval: safeClearInterval,
    clearTimeout: safeClearTimeout,
    setImmediate: safeSetImmediate,
    clearImmediate: safeClearImmediate,
  } = (globalThis as any)[SAFE_TIMERS_SYMBOL] || globalThis

  const {
    nextTick: safeNextTick,
  } = (globalThis as any)[SAFE_TIMERS_SYMBOL] || globalThis.process || { nextTick: (cb: () => void) => cb() }

  return {
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
  if (timersSafe)
    return
  timersSafe = true
  const {
    setTimeout: safeSetTimeout,
    setInterval: safeSetInterval,
    clearInterval: safeClearInterval,
    clearTimeout: safeClearTimeout,
    setImmediate: safeSetImmediate,
    clearImmediate: safeClearImmediate,
  } = globalThis

  const {
    nextTick: safeNextTick,
  } = globalThis.process || { nextTick: cb => cb() }

  const timers = {
    nextTick: safeNextTick,
    setTimeout: safeSetTimeout,
    setInterval: safeSetInterval,
    clearInterval: safeClearInterval,
    clearTimeout: safeClearTimeout,
    setImmediate: safeSetImmediate,
    clearImmediate: safeClearImmediate,
  }

  ;(globalThis as any)[SAFE_TIMERS_SYMBOL] = timers
}
