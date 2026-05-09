import type { RunnerTestCase, TestArtifact } from 'vitest'
import type { BrowserTraceData } from '../../../browser/src/client/tester/trace'
import { ref, watchEffect } from 'vue'
import { browserState, client, config } from './client'
import { detailsPosition } from './navigation'
import { selectedTest } from './params'

// TODO: review slop

export interface TraceSelection {
  test: RunnerTestCase
  attemptKey?: string
}

export const activeTraceView = ref<TraceSelection>()

function getTraceAttemptKey(trace: BrowserTraceData): string {
  return `${trace.repeats}:${trace.retry}`
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
    if (!attempt || !trace.stream) {
      attempts[key] = trace
      continue
    }

    if (attempt.stream) {
      attempts[key] = {
        ...attempt,
        entries: attempt.entries.concat(trace.entries),
      }
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

watchEffect(() => {
  const active = activeTraceView.value
  const testId = selectedTest.value

  if (testId) {
    const test = client.state.idMap.get(testId)
    if (test?.type === 'test') {
      if (active?.test.id === testId) {
        if (active.test !== test) {
          // Rerun produced a fresh test object; reset attempt selection.
          activeTraceView.value = { test }
        }
        return
      }

      if (isTraceViewEnabled(test)) {
        // Auto-open trace view when selecting a trace-enabled test.
        activeTraceView.value = { test }
        return
      }
    }
  }

  if (active) {
    // Close trace view when navigation moves away from a trace-enabled test.
    closeTrace()
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
