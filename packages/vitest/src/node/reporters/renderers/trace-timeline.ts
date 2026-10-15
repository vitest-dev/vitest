import type { TestArtifact } from '../../../runtime/runner/types'
import { relative } from 'pathe'
import c from 'tinyrainbow'
import { formatTime } from './utils'

interface TraceEntry {
  name: string
  range?: { id: string; phase: 'start' | 'end' }
  status?: 'pass' | 'fail'
  startTime: number
  location?: { file: string; line: number; column: number }
  element?: { locator: string }
}

interface TraceData {
  retry: number
  repeats: number
  entries: TraceEntry[]
}

interface TimelineStep extends TraceEntry {
  depth: number
  duration?: number
}

interface TimelineRow {
  cells: [time: string, duration: string, name: string, locator: string, location: string]
  status?: 'pass' | 'fail'
}

const MAX_STEPS = 10

export function formatTraceTimeline(artifacts: TestArtifact[], root: string): string | undefined {
  const attempt = getLastAttempt(artifacts)
  if (!attempt) {
    return
  }

  const steps = collectSteps(attempt.entries)
  // the test end is already shown by the error location
  const visible = steps.filter((step) => step.name !== 'vitest:onAfterRetryTask')
  if (!visible.length) {
    return
  }
  const shown = visible.slice(-MAX_STEPS)
  const headerRow: TimelineRow = { cells: ['start', 'duration', 'step', 'locator', 'location'] }
  const rows = [headerRow, ...shown.map((step) => formatStep(step, root))]

  const widths = headerRow.cells.map((_, i) => Math.max(...rows.map((row) => row.cells[i].length)))
  const lines = rows.map((row) => {
    const [time, duration, name, locator, location] = row.cells.map((cell, i) =>
      i === 0 ? cell.padStart(widths[i]) : cell.padEnd(widths[i]),
    )
    if (row === headerRow) {
      return c.dim(`  ${time}  ${duration}  ${name}  ${locator}  ${location}`.trimEnd())
    }
    const text = `  ${time}  ${duration}  ${name}  ${c.cyan(locator)}  ${c.dim(location)}`.trimEnd()
    return row.status === 'fail' ? c.red(text) : text
  })
  if (visible.length > shown.length) {
    lines.splice(1, 0, c.dim(`  ... ${visible.length - shown.length} earlier steps`))
  }

  const total = Math.max(...steps.map((step) => step.startTime + (step.duration ?? 0)))
  const header = [formatTime(total)]
  if (attempt.retry) {
    header.push(`retry ${attempt.retry}`)
  }
  if (attempt.repeats) {
    header.push(`repeat ${attempt.repeats}`)
  }
  return [`\nTrace (${header.join(', ')}):`, ...lines].join('\n')
}

function getLastAttempt(artifacts: TestArtifact[]): TraceData | undefined {
  const attempts = new Map<string, TraceData>()
  for (const artifact of artifacts) {
    if (artifact.type !== 'internal:browserTrace') {
      continue
    }
    const data = artifact.data as TraceData
    const key = `${data.repeats}:${data.retry}`
    const attempt = attempts.get(key)
    if (attempt) {
      attempt.entries.push(...data.entries)
    } else {
      attempts.set(key, { ...data, entries: [...data.entries] })
    }
  }
  return [...attempts.values()].at(-1)
}

function collectSteps(entries: TraceEntry[]): TimelineStep[] {
  const steps: TimelineStep[] = []
  const startIndexes = new Map<string, number>()
  let depth = 0
  for (const entry of entries) {
    if (!entry.range) {
      steps.push({ ...entry, depth })
    } else if (entry.range.phase === 'start') {
      startIndexes.set(entry.range.id, steps.length)
      steps.push({ ...entry, depth })
      depth++
    } else {
      const index = startIndexes.get(entry.range.id)
      if (index == null) {
        steps.push({ ...entry, depth: 0 })
        continue
      }
      const start = steps[index]
      steps[index] = {
        ...start,
        ...entry,
        depth: start.depth,
        startTime: start.startTime,
        duration: entry.startTime - start.startTime,
      }
      depth--
    }
  }
  return steps
}

function formatStep(step: TimelineStep, root: string): TimelineRow {
  const location = step.location
    ? `${relative(root, step.location.file)}:${step.location.line}:${step.location.column}`
    : ''
  return {
    cells: [
      formatTime(step.startTime),
      step.duration == null ? '' : formatTime(step.duration),
      `${'  '.repeat(step.depth)}${formatStepName(step.name)}`,
      step.element?.locator ?? '',
      location,
    ],
    status: step.status,
  }
}

function formatStepName(name: string): string {
  return name.startsWith('vitest:') ? name.slice('vitest:'.length) : name
}
