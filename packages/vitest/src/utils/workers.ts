import os from 'node:os'

export function getWorkersCountByPercentage(percent: string) {
  const maxWorkersCount = os.availableParallelism?.() ?? os.cpus().length
  const workersCountByPercentage = Math.round((Number.parseInt(percent) / 100) * maxWorkersCount)

  return Math.max(1, Math.min(maxWorkersCount, workersCountByPercentage))
}
