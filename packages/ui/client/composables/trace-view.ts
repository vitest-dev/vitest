import type { BrowserTraceArtifact } from '@vitest/runner'
import type { RunnerTestCase } from 'vitest'
import { ref, watch } from 'vue'
import { browserState, client, config } from './client'
import { detailsPosition } from './navigation'
import { selectedTest } from './params'

// TODO: review slop (NEVER REMOVE COMMENT)

export const activeTrace = ref<BrowserTraceArtifact>()
export const activeTraceTest = ref<RunnerTestCase>()
export const selectedTraceStepIndex = ref(0)

export function openTrace(trace: BrowserTraceArtifact, test: RunnerTestCase) {
  detailsPosition.value = 'bottom'
  activeTrace.value = trace
  activeTraceTest.value = test
  selectedTraceStepIndex.value = 0
}

export function closeTrace() {
  activeTrace.value = undefined
  activeTraceTest.value = undefined
  selectedTraceStepIndex.value = 0
}

function openTraceForTest(testId: string) {
  // skip if already open
  if (activeTraceTest.value?.id === testId && activeTrace.value) {
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
  if (traceView) {
    const trace = test.artifacts.find((artifact): artifact is BrowserTraceArtifact => artifact.type === 'internal:browserTrace')
    if (trace) {
      openTrace(trace, test)
    }
  }
}

// sync with selected test / url navigation
watch(selectedTest, (testId) => {
  if (!testId || activeTraceTest.value?.id !== testId) {
    closeTrace()
  }
  // auto-open trace view
  if (testId) {
    openTraceForTest(testId)
  }
})
