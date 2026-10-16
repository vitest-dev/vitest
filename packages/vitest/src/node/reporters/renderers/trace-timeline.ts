import type { TestArtifact } from '../../../runtime/runner/types'
import { relative } from 'pathe'
import c from 'tinyrainbow'
import { formatTime } from './utils'

interface TimelineRow {
  cells: [time: string, duration: string, name: string, locator: string, location: string]
  status?: 'pass' | 'fail'
}

const MAX_STEPS = 10

export function formatTraceTimeline(artifacts: TestArtifact[], root: string): string | undefined {
  const attempt = [...getTraceAttemptMap(artifacts).values()].at(-1)
  if (!attempt) {
    return
  }

  // the test end is already shown by the error location
  const visible = attempt.entries.filter((step) => step.name !== 'vitest:onAfterRetryTask')
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

  const header: string[] = []
  if (attempt.retry) {
    header.push(`retry ${attempt.retry}`)
  }
  if (attempt.repeats) {
    header.push(`repeat ${attempt.repeats}`)
  }
  const title = header.length ? `Trace (${header.join(', ')}):` : 'Trace:'
  return [`\n${title}`, ...lines].join('\n')
}

function formatStep(step: NormalizedBrowserTraceEntry, root: string): TimelineRow {
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

// TODO: everything below is copied from `BrowserTraceData`/`BrowserTraceEntry` in
// packages/browser/src/client/tester/trace.ts (only the fields used here) and
// `getTraceAttemptMap` in packages/ui/client/composables/trace-view.ts.
// share them instead (https://github.com/vitest-dev/vitest/pull/11604)

interface BrowserTraceData {
  retry: number
  repeats: number
  entries: BrowserTraceEntry[]
}

interface BrowserTraceEntry {
  name: string
  range?: { id: string; phase: 'start' | 'end' }
  status?: 'pass' | 'fail'
  startTime: number
  duration?: number
  location?: { file: string; line: number; column: number }
  element?: { locator: string }
}

interface NormalizedBrowserTraceData extends BrowserTraceData {
  entries: NormalizedBrowserTraceEntry[]
}

interface NormalizedBrowserTraceEntry extends BrowserTraceEntry {
  depth: number
}

function getTraceAttemptKey(trace: BrowserTraceData): string {
  return `${trace.repeats}:${trace.retry}`
}

function normalizeTraceEntries(entries: BrowserTraceEntry[]): NormalizedBrowserTraceEntry[] {
  const merged: NormalizedBrowserTraceEntry[] = []
  const startMap = new Map<string, number>()
  const parents: string[] = []

  for (const entry of entries) {
    const range = entry.range
    if (!range) {
      merged.push({
        ...entry,
        depth: parents.length,
      })
      continue
    }

    if (range.phase === 'start') {
      startMap.set(range.id, merged.length)
      merged.push({
        ...entry,
        depth: parents.length,
      })
      parents.push(range.id)
      continue
    }

    // when range.phase === 'end'
    const index = startMap.get(range.id)
    if (index == null) {
      // unpaired range shouldn't happen but just leave it there
      merged.push({ ...entry, depth: 0 })
      continue
    }

    // Keep the start timestamp for positioning, but derive display duration
    // from the end event timestamp.
    const start = merged[index]
    merged[index] = {
      ...start,
      ...entry,
      startTime: start.startTime,
      duration: entry.startTime - start.startTime,
    }
    parents.pop()
  }

  return merged
}

function getTraceAttemptMap(artifacts: TestArtifact[]): Map<string, NormalizedBrowserTraceData> {
  const grouped: Record<string, BrowserTraceData[]> = {}
  for (const artifact of artifacts) {
    if (artifact.type !== 'internal:browserTrace') {
      continue
    }
    const trace = artifact.data as BrowserTraceData
    const key = getTraceAttemptKey(trace)
    grouped[key] ??= []
    grouped[key].push(trace)
  }

  const merged = new Map<string, NormalizedBrowserTraceData>()
  for (const [key, traces] of Object.entries(grouped)) {
    const trace = traces[0]
    const entries = traces.flatMap((trace) => trace.entries)
    merged.set(key, {
      ...trace,
      entries: normalizeTraceEntries(entries),
    })
  }
  return merged
}
