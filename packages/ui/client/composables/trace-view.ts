import type { RunnerTestCase, RunnerTestFile, TestArtifact } from 'vitest'
import type { BrowserTraceData, BrowserTraceEntry } from '../../../browser/src/client/tester/trace'
import { ref, watch, watchEffect } from 'vue'
import { browserState, client, config } from './client'
import { detailsPosition } from './navigation'
import { selectedTest } from './params'

export interface TraceSelection {
  test: RunnerTestCase
  attemptKey?: string
  selectedStepIndex: number
}

export interface TraceEditorMarker {
  file: string
  line: number
  stepIndex: number
  entry: BrowserTraceEntry
  active?: boolean
}

export interface NormalizedBrowserTraceData extends BrowserTraceData {
  entries: NormalizedBrowserTraceEntry[]
}

export interface NormalizedBrowserTraceEntry extends BrowserTraceEntry {
  depth: number
}

export const activeTraceView = ref<TraceSelection>()

function getTraceAttemptKey(trace: BrowserTraceData): string {
  return `${trace.repeats}:${trace.retry}`
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

export function getTraceAttemptMap(artifacts: TestArtifact[]): Record<string, NormalizedBrowserTraceData> {
  const grouped: Record<string, BrowserTraceData[]> = {}
  for (const artifact of artifacts) {
    if (artifact.type !== 'internal:browserTrace') {
      continue
    }
    const trace = artifact.data as BrowserTraceData
    const key = getTraceAttemptKey(trace)
    grouped[key] ??= []
    grouped[key].push(trace)
  }

  const merged: Record<string, NormalizedBrowserTraceData> = {}
  for (const [key, traces] of Object.entries(grouped)) {
    const trace = traces[0]
    const entries = traces.flatMap(trace => trace.entries)
    merged[key] = {
      ...trace,
      entries: normalizeTraceEntries(entries),
    }
  }
  return merged
}

export function getSelectedTrace(selection: TraceSelection): NormalizedBrowserTraceData | undefined {
  const attempts = getTraceAttemptMap(selection.test.artifacts)
  return selection.attemptKey
    ? attempts[selection.attemptKey]
    : Object.values(attempts)[0]
}

export function getTraceEditorMarkersForFile(
  selection: TraceSelection,
  file: string,
): TraceEditorMarker[] {
  const trace = getSelectedTrace(selection)
  return getTraceEditorMarkers(trace?.entries ?? [])
    .filter(marker => marker.file === file)
    .map(marker => ({
      ...marker,
      active: marker.stepIndex === selection.selectedStepIndex,
    }))
}

function getTraceEditorMarkers(entries: BrowserTraceEntry[]): TraceEditorMarker[] {
  const markers: TraceEditorMarker[] = []
  const seen = new Set<string>()

  for (const [stepIndex, entry] of entries.entries()) {
    const location = entry.location
    if (!location) {
      continue
    }

    const key = `${location.file}:${location.line}`
    if (seen.has(key)) {
      continue
    }

    seen.add(key)
    markers.push({
      file: location.file,
      line: location.line,
      stepIndex,
      entry,
    })
  }

  return markers
}

export function getTraceEntryClass(entry: BrowserTraceEntry) {
  if (entry.range?.phase === 'start') {
    return 'text-yellow-500'
  }
  if (entry.status === 'fail') {
    return 'text-red-500'
  }
  if (entry.kind === 'action') {
    return 'text-blue-500'
  }
  if (entry.kind === 'expect') {
    return 'text-green-500'
  }
  if (entry.kind === 'mark') {
    return 'text-amber-500'
  }
  return 'text-gray-400 dark:text-gray-500'
}

export function openTrace(trace: BrowserTraceData, test: RunnerTestCase) {
  detailsPosition.value = 'bottom'
  activeTraceView.value = {
    test,
    attemptKey: getTraceAttemptKey(trace),
    selectedStepIndex: 0,
  }
}

export function closeTrace() {
  activeTraceView.value = undefined
}

export function selectActiveTraceStep(index: number) {
  const selection = activeTraceView.value
  if (selection) {
    selection.selectedStepIndex = index
  }
}

// Open/close only on selected-test navigation so the close button can clear the
// trace view without being auto-opened again for the same selected test.
watch(selectedTest, (testId) => {
  if (testId) {
    const test = client.state.idMap.get(testId)
    if (test?.type === 'test' && isTraceViewEnabled(test.file)) {
      // Auto-open trace view when selecting a trace-enabled test.
      activeTraceView.value = { test, selectedStepIndex: 0 }
      return
    }
  }

  // Close trace view when navigation moves away from a trace-enabled test.
  closeTrace()
})

// Keep the pane attached to the latest test object after reruns, and reset the
// attempt selection because retries/repeats belong to one run.
watchEffect(() => {
  const active = activeTraceView.value
  const testId = selectedTest.value
  if (active && testId && active.test.id === testId) {
    const test = client.state.idMap.get(testId)
    if (test?.type === 'test' && active.test !== test) {
      // Rerun produced a fresh test object; reset attempt selection.
      activeTraceView.value = { test, selectedStepIndex: 0 }
    }
  }
})

export function isTraceViewEnabled(test: RunnerTestFile): boolean {
  const project = getProjectConfigByTest(test)
  const traceView
    = browserState?.config.browser?.traceView
      ?? project?.browser.traceView
      ?? config.value.browser?.traceView
  return traceView?.enabled ?? false
}

function getProjectConfigByTest(test: RunnerTestFile) {
  const projectName = test.file.projectName || ''
  return config.value.projects?.find(project => project.name === projectName)
}

export function getTraceAttemptLabel(trace: BrowserTraceData) {
  const parts: string[] = []
  if (trace.retry) {
    parts.push(`Retry ${trace.retry}`)
  }
  if (trace.repeats) {
    parts.push(`Repeat ${trace.repeats}`)
  }
  return parts.join(' / ')
}
