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
  userCode: number
  vitest: number
  /** Phases sorted by time, descending. Phases below half a percent are dropped. */
  phases: DurationPhase[]
}

export interface DurationBreakdownInput {
  files: File[]
  /** Total typecheck time across all projects. */
  typecheckTime: number
}

export function computeDurationBreakdown(input: DurationBreakdownInput): DurationBreakdown {
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
  const userCode = sums.setup + sums.import + sums.tests
  const vitest = sums.transform + sums.environment + sums.worker + sums.typecheck
  const total = userCode + vitest
  const phases = entries
    .map(([name, time]) => ({
      name,
      time,
      percent: total > 0 ? (time / total) * 100 : 0,
    }))
    .filter((phase) => phase.percent >= 0.5)
    .sort((a, b) => b.time - a.time)

  return { total, userCode, vitest, phases }
}

export function formatDurationGroup(
  breakdown: DurationBreakdown,
  group: 'userCode' | 'vitest',
  includePhases = true,
): string {
  if (breakdown.total <= 0) {
    return ''
  }
  const userPercent = (breakdown.userCode / breakdown.total) * 100
  const rounded = Math.round(userPercent)
  const share =
    group === 'userCode'
      ? formatShare(userPercent, rounded)
      : formatShare(100 - userPercent, 100 - rounded)
  if (!includePhases) {
    return share
  }
  const phases = breakdown.phases
    .filter((phase) => {
      const userCode = phase.name === 'setup' || phase.name === 'import' || phase.name === 'tests'
      return userCode === (group === 'userCode')
    })
    .map((phase) => `${phase.name} ${formatShare(phase.percent, Math.round(phase.percent))}`)
    .join(', ')
  return share + (phases ? `: ${phases}` : '')
}

export function formatDurationSummary(breakdown: DurationBreakdown): string {
  if (breakdown.total <= 0) {
    return ''
  }
  return `user code ${formatDurationGroup(breakdown, 'userCode')}; Vitest ${formatDurationGroup(breakdown, 'vitest', false)}`
}

function formatShare(percent: number, rounded: number): string {
  if (percent > 0 && percent < 1) {
    return '<1%'
  }
  if (percent > 99 && percent < 100) {
    return '>99%'
  }
  return `${rounded}%`
}
