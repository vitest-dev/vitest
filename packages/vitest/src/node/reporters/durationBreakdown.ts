import type { File } from '../../runtime/runner/types'

interface DurationPhase {
  name: string
  time: number
  /** Share of the tracked time, in percent (0-100). */
  percent: number
}

export interface DurationBreakdown {
  /** Summed time of all tracked phases. */
  total: number
  /** Phases sorted by time, descending. Phases below half a percent are dropped. */
  phases: DurationPhase[]
}

export interface DurationBreakdownInput {
  files: File[]
  /** Total typecheck time across all projects. */
  typecheckTime: number
}

export function computeDurationBreakdown(
  input: DurationBreakdownInput,
): DurationBreakdown {
  const sums = {
    transform: 0,
    setup: 0,
    import: 0,
    tests: 0,
    environment: 0,
    worker: 0,
    typecheck: input.typecheckTime,
  }
  for (const file of input.files) {
    // setup and collect wall times include the time the worker spent waiting
    // for module transforms; report that wait as its own "transform" phase so
    // every phase is a disjoint sum of per-worker time
    const setupFetch = file.setupFetchDuration || 0
    const collectFetch = file.collectFetchDuration || 0
    sums.transform += setupFetch + collectFetch
    sums.setup += Math.max((file.setupDuration || 0) - setupFetch, 0)
    sums.import += Math.max((file.collectDuration || 0) - collectFetch, 0)
    sums.tests += file.result?.duration || 0
    sums.environment += file.environmentLoad || 0
    sums.worker += file.prepareDuration || 0
  }

  const entries = Object.entries(sums)
  const total = entries.reduce((acc, [, time]) => acc + time, 0)
  const phases = entries
    .map(([name, time]) => ({
      name,
      time,
      percent: total > 0 ? (time / total) * 100 : 0,
    }))
    .filter(phase => phase.percent >= 0.5)
    .sort((a, b) => b.time - a.time)

  return { total, phases }
}

export function formatDurationBreakdown(breakdown: DurationBreakdown): string {
  return breakdown.phases
    .map(phase => `${phase.name} ${formatPercent(phase.percent)}`)
    .join(', ')
}

function formatPercent(percent: number): string {
  // sub-1% shares round to "1%" instead of a misleading "0%"
  return `${Math.max(1, Math.round(percent))}%`
}
