import type { BrowserTraceArtifact } from '@vitest/runner'
import type { RunnerTestCase } from 'vitest'
import { ref, watch } from 'vue'
import { browserState, client, config } from './client'
import { detailsPosition } from './navigation'
import { selectedTest } from './params'

export interface ActiveTraceView {
  trace: BrowserTraceArtifact
  test: RunnerTestCase
}

export const activeTraceView = ref<ActiveTraceView>()

export function openTrace(trace: BrowserTraceArtifact, test: RunnerTestCase) {
  detailsPosition.value = 'bottom'
  activeTraceView.value = {
    trace,
    test,
  }
}

export function closeTrace() {
  activeTraceView.value = undefined
}

function openTraceForTest(testId: string) {
  // skip if already open
  if (activeTraceView.value?.test.id === testId) {
    return
  }

  const test = client.state.idMap.get(testId)
  if (test?.type !== 'test') {
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
  // auto-open trace view
  if (testId) {
    openTraceForTest(testId)
  }
})
