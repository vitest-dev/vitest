import { availableParallelism } from 'node:os'

export function getDefaultMaxWorkers(watch: boolean): number {
  const count = availableParallelism()
  return watch ? Math.max(Math.floor(count / 2), 1) : Math.max(count - 1, 1)
}

export function resolveMaxWorkers(value: number | string): number {
  if (typeof value === 'string' && value.trim().endsWith('%')) {
    const count = availableParallelism()
    const byPercentage = Math.round((Number.parseInt(value) / 100) * count)
    return Math.max(1, Math.min(count, byPercentage))
  }
  return Number(value)
}
