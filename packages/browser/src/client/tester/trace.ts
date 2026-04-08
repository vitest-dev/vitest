import { getWorkerState } from '../utils'

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

export function consumeBrowserTrace(testId: string): BrowserTraceData | undefined {
  const steps = browserTraceEntries.get(testId)
  browserTraceEntries.delete(testId)
  if (!steps?.length) {
    return undefined
  }
  return { steps }
}
