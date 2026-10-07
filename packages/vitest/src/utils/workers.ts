import os from 'node:os'

function getAvailableParallelism(): number {
  return os.availableParallelism?.() ?? os.cpus().length
}

export function getDefaultMaxWorkers(watch: boolean): number {
  const count = getAvailableParallelism()
  return watch ? Math.max(Math.floor(count / 2), 1) : Math.max(count - 1, 1)
}

export function resolveMaxWorkers(value: number | string): number {
  if (typeof value === 'string' && value.trim().endsWith('%')) {
    const count = getAvailableParallelism()
    const byPercentage = Math.round((Number.parseInt(value) / 100) * count)
    return Math.max(1, Math.min(count, byPercentage))
  }
  return Number(value)
}
