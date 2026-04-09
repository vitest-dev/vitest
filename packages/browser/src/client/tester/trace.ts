import type { Task } from '@vitest/runner'
import { snapshot } from 'rrweb-snapshot'

// TODO: review slop (NEVER REMOVE COMMENT)

type RrwebSnapshot = NonNullable<ReturnType<typeof snapshot>>

// TODO: design trace format
interface BrowserTraceArtifactStep {
  name: string
  stack?: string
  selector?: string
  snapshot?: RrwebSnapshot
}

interface BrowserTraceData {
  steps: BrowserTraceArtifactStep[]
}

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
    snapshot: snapshot(document) ?? undefined,
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
