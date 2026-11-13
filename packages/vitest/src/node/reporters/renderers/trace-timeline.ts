import type { BrowserTraceData, NormalizedBrowserTraceEntry } from '@vitest/utils/trace'
import type { TaskResultAttempt, Test } from '../../../runtime/runner/types'
import { getTraceAttemptKey, groupTraceAttempts } from '@vitest/utils/trace'
import { relative } from 'pathe'
import c from 'tinyrainbow'
import { isRepeatReplay } from '../../../utils/tasks'
import { F_TREE_NODE_END, F_TREE_NODE_MIDDLE } from './figures'

interface TimelineRow {
  cells: [name: string, locator: string, start: string, duration: string, location: string]
  status?: 'pass' | 'fail'
}

const MAX_STEPS = 10

export function formatTraceTimeline(
  test: Test,
  { retryIndex, repeatIndex }: TaskResultAttempt,
  root: string,
): string | undefined {
  const traces = test.artifacts.flatMap((artifact) =>
    artifact.type === 'internal:browserTrace' ? [artifact.data as BrowserTraceData] : [],
  )
  const attempt = groupTraceAttempts(traces).get(
    getTraceAttemptKey({ retry: retryIndex, repeats: repeatIndex }),
  )
  if (!attempt) {
    return
  }

  // the test end is already shown by the error location
  const visible = attempt.entries.filter((step) => step.name !== 'vitest:onAfterRetryTask')
  if (!visible.length) {
    return
  }
  const shown = visible.slice(-MAX_STEPS)
  const prefixes = getTreePrefixes(shown)
  const headerRow: TimelineRow = { cells: ['step', 'locator', 'start', 'duration', 'location'] }
  const rows = [headerRow, ...shown.map((step, i) => formatStep(step, prefixes[i], root))]

  const widths = headerRow.cells.map((_, i) => Math.max(...rows.map((row) => row.cells[i].length)))
  const hasLocator = shown.some((step) => step.element?.locator)
  const lines = rows.map((row) => {
    // the last column is left unpadded so rows have no trailing spaces inside its color codes
    const [name, locator, start, duration, location] = row.cells.map((cell, i) =>
      i === 4 ? cell : i === 2 || i === 3 ? cell.padStart(widths[i]) : cell.padEnd(widths[i]),
    )
    if (row === headerRow) {
      const locatorColumn = hasLocator ? `${locator}  ` : ''
      return c.dim(`  ${name}  ${locatorColumn}${start}  ${duration}  ${location}`)
    }
    const locatorColumn = hasLocator ? `${colorCell(locator, c.cyan)}  ` : ''
    const text = `  ${name}  ${locatorColumn}${start}  ${colorCell(duration)}  ${colorCell(location, c.dim)}`
    return row.status === 'fail' ? c.red(text) : text
  })
  const omitted = visible.length - shown.length
  if (omitted) {
    lines.splice(1, 0, c.dim(`  ... ${omitted} earlier ${omitted === 1 ? 'step' : 'steps'}`))
  }

  const header: string[] = []
  if (attempt.retry) {
    const replay = attempt.repeats ? 'replay' : 'replay of initial run'
    header.push(isRepeatReplay(test, attempt.retry) ? replay : `retry ${attempt.retry}`)
  }
  if (attempt.repeats) {
    header.push(`repeat ${attempt.repeats}`)
  }
  const title = header.length ? `Trace (${header.join(', ')}):` : 'Trace:'
  return [`\n${title}`, ...lines].join('\n')
}

function getTreePrefixes(steps: NormalizedBrowserTraceEntry[]): string[] {
  const hasNextSibling = steps.map((step, i) => {
    const next = steps.slice(i + 1).find((other) => other.depth <= step.depth)
    return next?.depth === step.depth
  })
  const lastAtDepth: number[] = []
  return steps.map((step, i) => {
    lastAtDepth[step.depth] = i
    if (step.depth === 0) {
      return ''
    }
    let prefix = ''
    for (let level = 1; level < step.depth; level++) {
      prefix += hasNextSibling[lastAtDepth[level]] ? '│   ' : '    '
    }
    return `${prefix}${hasNextSibling[i] ? F_TREE_NODE_MIDDLE : F_TREE_NODE_END} `
  })
}

function formatStep(step: NormalizedBrowserTraceEntry, prefix: string, root: string): TimelineRow {
  const location =
    step.location &&
    `${relative(root, step.location.file)}:${step.location.line}:${step.location.column}`
  return {
    cells: [
      `${prefix}${formatStepName(step.name)}`,
      step.element?.locator || '-',
      `+${formatMs(step.startTime)}`,
      step.duration == null ? '-' : formatMs(step.duration),
      location || '-',
    ],
    status: step.status,
  }
}

function colorCell(cell: string, format = (text: string) => text): string {
  return cell.trim() === '-' ? c.dim(cell) : format(cell)
}

function formatMs(ms: number): string {
  return `${Math.round(ms)}ms`
}

function formatStepName(name: string): string {
  return name.startsWith('vitest:') ? name.slice('vitest:'.length) : name
}
