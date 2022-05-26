const {
  setTimeout: safeSetTimeout,
  setInterval: safeSetInterval,
  clearInterval: safeClearInterval,
  clearTimeout: safeClearTimeout,
} = globalThis

export {
  safeSetTimeout as setTimeout,
  safeSetInterval as setInterval,
  safeClearInterval as clearInterval,
  safeClearTimeout as clearTimeout,
}

// can only work with sync code to not potentially mess with other code
export function withSafeTimers(fn: () => void) {
  const currentSetTimeout = globalThis.setTimeout
  const currentSetInterval = globalThis.setInterval
  const currentClearInterval = globalThis.clearInterval
  const currentClearTimeout = globalThis.clearTimeout

  try {
    globalThis.setTimeout = safeSetTimeout
    globalThis.setInterval = safeSetInterval
    globalThis.clearInterval = safeClearInterval
    globalThis.clearTimeout = safeClearTimeout

    const result = fn()
    return result
  }
  finally {
    globalThis.setTimeout = currentSetTimeout
    globalThis.setInterval = currentSetInterval
    globalThis.clearInterval = currentClearInterval
    globalThis.clearTimeout = currentClearTimeout
  }
}
