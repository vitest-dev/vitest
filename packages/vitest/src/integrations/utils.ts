// Runtime utils exposed to `vitest`

export function getRunningMode() {
  return process.env.VITEST_MODE === 'WATCH' ? 'watch' : 'run'
}

export function isWatchMode() {
  return getRunningMode() === 'watch'
}
