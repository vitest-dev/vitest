// Runtime utils exposed to `vitest`

export function getRunningMode(): 'watch' | 'run' {
  return process.env.VITEST_MODE === 'WATCH' ? 'watch' : 'run'
}

export function isWatchMode(): boolean {
  return getRunningMode() === 'watch'
}
