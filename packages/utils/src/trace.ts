interface TraceEntryLike {
  range?: {
    id: string
    phase: 'start' | 'end'
  }
  startTime: number
  duration?: number
  snapshot?: unknown
}

interface TraceDataLike<Entry extends TraceEntryLike> {
  retry: number
  repeats: number
  entries: Entry[]
}

export type NormalizedTraceEntry<Entry extends TraceEntryLike> = Entry & { depth: number }

export type NormalizedTraceData<Data extends TraceDataLike<TraceEntryLike>> = Omit<
  Data,
  'entries'
> & {
  entries: NormalizedTraceEntry<Data['entries'][number]>[]
}

export function groupTraceAttempts<Data extends TraceDataLike<TraceEntryLike>>(
  traces: Data[],
): Map<string, NormalizedTraceData<Data>> {
  const grouped = new Map<string, Data[]>()
  for (const trace of traces) {
    const key = `${trace.repeats}:${trace.retry}`
    grouped.set(key, [...(grouped.get(key) ?? []), trace])
  }

  const merged = new Map<string, NormalizedTraceData<Data>>()
  for (const [key, traces] of grouped) {
    merged.set(key, {
      ...traces[0],
      entries: normalizeTraceEntries(traces.flatMap((trace) => trace.entries)),
    })
  }
  return merged
}

export function normalizeTraceEntries<Entry extends TraceEntryLike>(
  entries: Entry[],
): NormalizedTraceEntry<Entry>[] {
  const merged: NormalizedTraceEntry<Entry>[] = []
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
      snapshot: entry.snapshot ?? start.snapshot,
    }
    parents.pop()
  }

  return merged
}
