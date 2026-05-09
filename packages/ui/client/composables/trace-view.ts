import type { BrowserTraceArtifact } from '@vitest/runner'
import type { RunnerTestCase, TestArtifact } from 'vitest'
import type { BrowserTraceData } from '../../../browser/src/client/tester/trace'
import { ref, watch, watchEffect } from 'vue'
import { browserState, client, config } from './client'
import { detailsPosition } from './navigation'
import { selectedTest } from './params'

// TODO: review slop

export interface ActiveTraceView {
  test: RunnerTestCase
  attemptKey: string
  trace?: BrowserTraceArtifactWithData
}

export interface BrowserTraceArtifactWithData extends Omit<BrowserTraceArtifact, 'data'> {
  // fill up actual data type since runner-level BrowserTraceArtifact has `unknown`
  data: BrowserTraceData
}

export const activeTraceView = ref<ActiveTraceView>()

function getTraceAttemptKey(trace: BrowserTraceData): string {
  return `${trace.repeats}:${trace.retry}`
}

export function getTraceAttemptMap(artifacts: TestArtifact[]): Record<string, BrowserTraceData> {
  const attempts: Record<string, BrowserTraceData> = {}
  for (const artifact of artifacts) {
    if (artifact.type !== 'internal:browserTrace') {
      continue
    }

    const trace = artifact as BrowserTraceArtifactWithData
    const key = getTraceAttemptKey(trace.data)
    const attempt = attempts[key]
    if (!attempt || !trace.data.stream) {
      attempts[key] = trace.data
      continue
    }

    if (attempt.stream) {
      attempts[key] = {
        ...attempt,
        entries: attempt.entries.concat(trace.data.entries),
      }
    }
  }

  return attempts
}

export function getTraceAttempts(test: RunnerTestCase): BrowserTraceArtifactWithData[] {
  return Object.values(getTraceAttemptMap(test.artifacts)).map(data => ({
    type: 'internal:browserTrace',
    data,
  }))
}

export function openTrace(trace: BrowserTraceArtifactWithData, test: RunnerTestCase) {
  detailsPosition.value = 'bottom'
  activeTraceView.value = {
    test,
    attemptKey: getTraceAttemptKey(trace.data),
    trace,
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
      // TODO: make it optional to pick first?
      attemptKey: '0:0',
    }
  }
})

// Refresh derived trace data as new stream artifacts are appended to the active test.
watchEffect(() => {
  const active = activeTraceView.value
  if (!active) {
    return
  }

  let trace: BrowserTraceArtifactWithData | undefined
  const data = getTraceAttemptMap(active.test.artifacts)[active.attemptKey]
  if (data) {
    trace = {
      type: 'internal:browserTrace',
      data,
    }
  }

  if (
    trace?.data.entries.length !== active.trace?.data.entries.length
    || trace?.data.stream !== active.trace?.data.stream
  ) {
    activeTraceView.value = {
      ...active,
      trace,
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
      // TODO: sad
      attemptKey: '0:0',
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
