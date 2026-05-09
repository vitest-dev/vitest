import type { RunnerTestCase, TestArtifact } from 'vitest'
import type { BrowserTraceData } from '../../../browser/src/client/tester/trace'
import { ref, watch, watchEffect } from 'vue'
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

// Close trace view when URL/navigation moves away from the active test.
watch(selectedTest, (testId) => {
  if (!testId || activeTraceView.value?.test.id !== testId) {
    closeTrace()
  }
})

// Keep the pane open across reruns by replacing stale test object references.
watchEffect(() => {
  const active = activeTraceView.value
  const testId = selectedTest.value
  if (!active || !testId || active.test.id !== testId) {
    return
  }

  const test = client.state.idMap.get(testId)
  if (test?.type === 'test' && active.test !== test) {
    activeTraceView.value = {
      test,
    }
  }
})

// Auto-open trace view for the selected test
watchEffect(() => {
  const testId = selectedTest.value
  if (!testId || activeTraceView.value?.test.id === testId) {
    return
  }

  const test = client.state.idMap.get(testId)
  if (test?.type !== 'test') {
    return
  }

  if (isTraceViewEnabled(test)) {
    activeTraceView.value = {
      test,
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
