import type { Task } from '@vitest/runner'

// TODO: review slop (NEVER REMOVE COMMENT)

// TODO: design trace format
interface BrowserTraceArtifactStep {
  name: string
  stack?: string
  selector?: string
  snapshot: unknown
}

interface BrowserTraceData {
  steps: BrowserTraceArtifactStep[]
}

// lazily loaded when trace is enabled on runner.ts
declare let __vitest_dom_snapshot__: typeof import('rrweb-snapshot')

// TODO: why global
const browserTraceEntries: Map<string, BrowserTraceArtifactStep[]>
  = ((globalThis as any).__vitest_browser_trace__ ??= new Map())

export function recordBrowserTraceEntry(
  task: Task,
  payload: Omit<BrowserTraceArtifactStep, 'timestamp' | 'snapshot'>,
): void {
  // TODO: split entries by
  // task.repeats
  // task.retry
  const entries = browserTraceEntries.get(task.id) || []
  entries.push({
    ...payload,
    snapshot: __vitest_dom_snapshot__.snapshot(document),
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
