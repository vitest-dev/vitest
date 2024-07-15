const SAFE_TIMERS_SYMBOL = Symbol('vitest:SAFE_TIMERS')

export interface SafeTimers {
  nextTick: (cb: () => void) => void
  setTimeout: typeof setTimeout
  setInterval: typeof setInterval
  clearInterval: typeof clearInterval
  clearTimeout: typeof clearTimeout
  setImmediate: typeof setImmediate
  clearImmediate: typeof clearImmediate
}

export function getSafeTimers(): SafeTimers {
  const {
    setTimeout: safeSetTimeout,
    setInterval: safeSetInterval,
    clearInterval: safeClearInterval,
    clearTimeout: safeClearTimeout,
    setImmediate: safeSetImmediate,
    clearImmediate: safeClearImmediate,
  } = (globalThis as any)[SAFE_TIMERS_SYMBOL] || globalThis

  const { nextTick: safeNextTick } = (globalThis as any)[SAFE_TIMERS_SYMBOL]
    || globalThis.process || { nextTick: (cb: () => void) => cb() }

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

export function setSafeTimers(): void {
  const {
    setTimeout: safeSetTimeout,
    setInterval: safeSetInterval,
    clearInterval: safeClearInterval,
    clearTimeout: safeClearTimeout,
    setImmediate: safeSetImmediate,
    clearImmediate: safeClearImmediate,
  } = globalThis

  const { nextTick: safeNextTick } = globalThis.process || {
    nextTick: cb => cb(),
  }

  const timers = {
    nextTick: safeNextTick,
    setTimeout: safeSetTimeout,
    setInterval: safeSetInterval,
    clearInterval: safeClearInterval,
    clearTimeout: safeClearTimeout,
    setImmediate: safeSetImmediate,
    clearImmediate: safeClearImmediate,
  };

  (globalThis as any)[SAFE_TIMERS_SYMBOL] = timers
}
