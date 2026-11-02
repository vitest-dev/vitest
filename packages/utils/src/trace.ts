export type BrowserTraceEntryKind = 'action' | 'expect' | 'mark' | 'lifecycle'

export type BrowserTraceEntryStatus = 'pass' | 'fail'

export interface BrowserTraceData {
  retry: number
  repeats: number
  // UI has access to original config but let artifact own this
  recordCanvas?: boolean
  // In 'on' mode each artifact carries one entry, and in 'failure-only' mode one
  // artifact carries the whole attempt. Consumers merge entries by attempt.
  entries: BrowserTraceEntry[]
}

export interface BrowserTraceEntry {
  name: string
  kind: BrowserTraceEntryKind
  range?: {
    id: string
    phase: 'start' | 'end'
  }
  status?: BrowserTraceEntryStatus
  startTime: number
  // derived from range start/end entries when entries are merged by attempt
  duration?: number
  stack?: string
  // resolved from stack in the main process
  location?: { file: string; line: number; column: number }
  element?: {
    selector: string
    locator: string
  }
  snapshot?: BrowserTraceSnapshot
}

export interface BrowserTraceSnapshot {
  serialized: unknown
  viewport: {
    width: number
    height: number
  }
  scroll: {
    x: number
    y: number
  }
  selectorIds?: number[]
  // not used yet for UI but tested
  selectorResolution?: 'matched' | 'missing' | 'error'
  selectorError?: string
  pseudoClassIds: Record<string, number[]>
  ariaSnapshot?: string
}

export interface NormalizedBrowserTraceData extends Omit<BrowserTraceData, 'entries'> {
  entries: NormalizedBrowserTraceEntry[]
}

export interface NormalizedBrowserTraceEntry extends BrowserTraceEntry {
  depth: number
}

export function getTraceAttemptKey(trace: { retry: number; repeats: number }): string {
  return `${trace.repeats}:${trace.retry}`
}

export function groupTraceAttempts(
  traces: BrowserTraceData[],
): Map<string, NormalizedBrowserTraceData> {
  const grouped = new Map<string, BrowserTraceData[]>()
  for (const trace of traces) {
    const key = getTraceAttemptKey(trace)
    const group = grouped.get(key)
    if (group) {
      group.push(trace)
    } else {
      grouped.set(key, [trace])
    }
  }

  const merged = new Map<string, NormalizedBrowserTraceData>()
  for (const [key, traces] of grouped) {
    merged.set(key, {
      ...traces[0],
      entries: normalizeTraceEntries(traces.flatMap((trace) => trace.entries)),
    })
  }
  return merged
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
