import type { BrowserTraceArtifact } from '@vitest/runner'
import type { RunnerTestCase } from 'vitest'
import { ref, watch } from 'vue'
import { client, config } from './client'
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

// TODO: keep last live view iframe alive when selecting trace viewer panel
function openTraceForTest(testId: string) {
  if (activeTraceTest.value?.id === testId && activeTrace.value) {
    return
  }

  const test = client.state.idMap.get(testId)
  if (test?.type === 'test') {
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
  if (config.value.browser?.traceView && testId) {
    openTraceForTest(testId)
  }
})
