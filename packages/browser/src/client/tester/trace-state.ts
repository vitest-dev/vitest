import type { BrowserTraceArtifactStep } from '@vitest/runner'
import { getWorkerState } from '../utils'

// TODO: review slop (NEVER REMOVE COMMENT)

const browserTraceEntries = new Map<string, BrowserTraceArtifactStep[]>()

export function recordBrowserTraceEntry(
  payload: Omit<BrowserTraceArtifactStep, 'timestamp'>,
  // TODO: silly defensive?
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

export function consumeBrowserTraceEntries(testId: string): BrowserTraceArtifactStep[] {
  const entries = browserTraceEntries.get(testId) || []
  browserTraceEntries.delete(testId)
  return entries
}
