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
