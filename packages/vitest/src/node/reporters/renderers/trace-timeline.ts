import type { NormalizedTraceEntry } from '@vitest/utils/trace'
import type { BrowserTraceEntry, TestArtifact } from '../../../runtime/runner/types'
import { groupTraceAttempts } from '@vitest/utils/trace'
import { relative } from 'pathe'
import c from 'tinyrainbow'
import { formatTime } from './utils'

interface TimelineRow {
  cells: [time: string, duration: string, name: string, locator: string, location: string]
  status?: 'pass' | 'fail'
}

const MAX_STEPS = 10

export function formatTraceTimeline(artifacts: TestArtifact[], root: string): string | undefined {
  const attempts = groupTraceAttempts(
    artifacts.flatMap((artifact) =>
      artifact.type === 'internal:browserTrace' ? [artifact.data] : [],
    ),
  )
  const attempt = [...attempts.values()].at(-1)
  if (!attempt) {
    return
  }

  const steps = attempt.entries
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

function formatStep(step: NormalizedTraceEntry<BrowserTraceEntry>, root: string): TimelineRow {
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
