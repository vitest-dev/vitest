import type { RunnerTestCase, TestArtifact } from 'vitest'
import type { BrowserTraceData, BrowserTraceEntry } from '../../../browser/src/client/tester/trace'
import { ref, watch, watchEffect } from 'vue'
import { browserState, client, config } from './client'
import { detailsPosition } from './navigation'
import { selectedTest } from './params'

// TODO: slop

export interface TraceSelection {
  test: RunnerTestCase
  attemptKey?: string
}

export const activeTraceView = ref<TraceSelection>()

function getTraceAttemptKey(trace: BrowserTraceData): string {
  return `${trace.repeats}:${trace.retry}`
}

function mergeTraceRangeEntries(entries: BrowserTraceEntry[]): BrowserTraceEntry[] {
  const merged: BrowserTraceEntry[] = []
  const ranges = new Map<string, number>()

  for (const entry of entries) {
    const range = entry.range
    if (!range) {
      merged.push(entry)
      continue
    }

    if (range.phase === 'start') {
      ranges.set(range.id, merged.length)
      merged.push(entry)
      continue
    }

    const index = ranges.get(range.id)
    if (index == null) {
      merged.push(entry)
      continue
    }

    const start = merged[index]
    // Keep completed ranges at the start position; nested entries remain
    // visible after the parent range until the UI models nested trace groups.
    merged[index] = {
      ...start,
      ...entry,
      startTime: start.startTime,
    }
  }

  return merged
}

export function getTraceAttemptMap(artifacts: TestArtifact[]): Record<string, BrowserTraceData> {
  const attempts: Record<string, BrowserTraceData> = {}
  for (const artifact of artifacts) {
    if (artifact.type !== 'internal:browserTrace') {
      continue
    }

    const trace = artifact.data as BrowserTraceData
    const key = getTraceAttemptKey(trace)
    const attempt = attempts[key]
    attempts[key] = {
      ...(attempt ?? trace),
      entries: attempt ? attempt.entries.concat(trace.entries) : trace.entries,
    }
  }

  for (const key in attempts) {
    attempts[key] = {
      ...attempts[key],
      entries: mergeTraceRangeEntries(attempts[key].entries),
    }
  }

  return attempts
}

export function getSelectedTrace(selection: TraceSelection): BrowserTraceData | undefined {
  const attempts = getTraceAttemptMap(selection.test.artifacts)
  return selection.attemptKey
    ? attempts[selection.attemptKey]
    : Object.values(attempts)[0]
}

export function openTrace(trace: BrowserTraceData, test: RunnerTestCase) {
  detailsPosition.value = 'bottom'
  activeTraceView.value = {
    test,
    attemptKey: getTraceAttemptKey(trace),
  }
}

export function closeTrace() {
  activeTraceView.value = undefined
}

// Open/close only on selected-test navigation so the close button can clear the
// trace view without being auto-opened again for the same selected test.
watch(selectedTest, (testId) => {
  if (testId) {
    const test = client.state.idMap.get(testId)
    if (test?.type === 'test' && isTraceViewEnabled(test)) {
      // Auto-open trace view when selecting a trace-enabled test.
      activeTraceView.value = { test }
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
      activeTraceView.value = { test }
    }
  }
})

function isTraceViewEnabled(test: RunnerTestCase): boolean {
  const project = getProjectConfigByTest(test)
  const traceView
    = browserState?.config.browser?.traceView
      ?? project?.browser.traceView
      ?? config.value.browser?.traceView
  return traceView?.enabled ?? false
}

function getProjectConfigByTest(test: RunnerTestCase) {
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
