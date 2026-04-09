import type { Task } from '@vitest/runner'

// TODO: review slop (NEVER REMOVE COMMENT)

// TODO: design trace format
export interface BrowserTraceData {
  steps: BrowserTraceEntry[]
}

export interface BrowserTraceEntry {
  name: string
  // TODO: resolve location (need to go server?)
  stack?: string
  selector?: string
  snapshot: unknown
}

// lazily loaded when trace is enabled on runner.ts
declare let __vitest_dom_snapshot__: typeof import('rrweb-snapshot')

// TODO: why global
const browserTraceEntries: Map<string, BrowserTraceEntry[]>
  = ((globalThis as any).__vitest_browser_trace__ ??= new Map())

// TODO: should we avoid accumulating? send snapshot and clear to save memory?
export function recordBrowserTraceEntry(
  task: Task,
  payload: Omit<BrowserTraceEntry, 'timestamp' | 'snapshot'>,
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
