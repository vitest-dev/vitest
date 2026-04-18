import type { BrowserTraceArtifact } from '@vitest/runner'
import type { RunnerTestCase } from 'vitest'
import type { BrowserTraceData } from '../../../browser/src/client/tester/trace'
import { ref, watch } from 'vue'
import { browserState, client, config } from './client'
import { finished } from './client/state'
import { detailsPosition } from './navigation'
import { selectedTest } from './params'

export interface ActiveTraceView {
  test: RunnerTestCase
  trace: BrowserTraceArtifactWithData
}

export interface BrowserTraceArtifactWithData extends Omit<BrowserTraceArtifact, 'data'> {
  // fill up actual data type since runner-level BrowserTraceArtifact has `unknown`
  data: BrowserTraceData
}

export const activeTraceView = ref<ActiveTraceView>()

export function openTrace(trace: BrowserTraceArtifact, test: RunnerTestCase) {
  detailsPosition.value = 'bottom'
  activeTraceView.value = {
    test,
    trace: trace as BrowserTraceArtifactWithData,
  }
}

export function closeTrace() {
  activeTraceView.value = undefined
}

function openTraceForTest(testId: string) {
  const test = client.state.idMap.get(testId)
  if (test?.type !== 'test') {
    return
  }

  // skip if already open
  if (test === activeTraceView.value?.test) {
    return
  }

  const projectName = test.file.projectName || ''
  const project = config.value.projects?.find(project => project.name === projectName)
  const traceView
    = browserState?.config.browser?.traceView
      ?? project?.browser.traceView
      ?? config.value.browser?.traceView
  if (traceView?.enabled) {
    const trace = test.artifacts.find((artifact): artifact is BrowserTraceArtifact => artifact.type === 'internal:browserTrace')
    if (trace) {
      openTrace(trace, test)
    }
  }
}

// sync with selected test / url navigation
watch(selectedTest, (testId) => {
  if (!testId || activeTraceView.value?.test.id !== testId) {
    closeTrace()
  }
  // auto open trace view
  if (testId) {
    openTraceForTest(testId)
  }
})

watch(finished, (isFinished) => {
  // TODO: test in test/ui
  // auto reload currently active trace view on re-run
  if (isFinished) {
    const testId = activeTraceView.value?.test.id
    if (testId) {
      openTraceForTest(testId)
    }
  }
})

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
