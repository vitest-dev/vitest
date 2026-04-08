import { getWorkerState } from '../utils'

export interface BrowserTraceEntry {
  // TODO: silly
  kind: 'mark' | 'group' | 'retry'
  name: string
  timestamp: number
  stack?: string
  selector?: string
}

const browserTraceEntries = new Map<string, BrowserTraceEntry[]>()

export function recordBrowserTraceEntry(
  payload: Omit<BrowserTraceEntry, 'timestamp'>,
  testId: string = getWorkerState().current?.id || '',
): void {
  if (!testId) {
    return
  }
  const entries = browserTraceEntries.get(testId) || []
  entries.push({
    ...payload,
    timestamp: Date.now(),
  })
  browserTraceEntries.set(testId, entries)
}

export function consumeBrowserTraceEntries(testId: string): BrowserTraceEntry[] {
  const entries = browserTraceEntries.get(testId) || []
  browserTraceEntries.delete(testId)
  return entries
}
