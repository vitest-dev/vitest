import type { Task } from '@vitest/runner'

// TODO: review slop (NEVER REMOVE COMMENT)

interface BrowserTraceArtifactStep {
  name: string
  timestamp: number
  stack?: string
  selector?: string
}

interface BrowserTraceData {
  steps: BrowserTraceArtifactStep[]
}

// TODO: why global
const browserTraceEntries: Map<string, BrowserTraceArtifactStep[]>
  = ((globalThis as any).__vitest_browser_trace__ ??= new Map())

export function recordBrowserTraceEntry(
  task: Task,
  payload: Omit<BrowserTraceArtifactStep, 'timestamp'>,
): void {
  // TODO: split entries by
  // task.repeats
  // task.retry
  const entries = browserTraceEntries.get(task.id) || []
  entries.push({
    ...payload,
    timestamp: Date.now(),
  })
  browserTraceEntries.set(task.id, entries)
}

export function getBrowserTrace(testId: string): BrowserTraceData | undefined {
  const steps = browserTraceEntries.get(testId)
  browserTraceEntries.delete(testId)
  if (!steps?.length) {
    return
  }
  return { steps }
}
