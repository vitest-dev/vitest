import type { BrowserTraceArtifact } from '@vitest/runner'
import type { RunnerTestCase } from 'vitest'
import { ref, watch } from 'vue'
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

watch(selectedTest, (testId) => {
  if (!testId || activeTraceTest.value?.id !== testId) {
    closeTrace()
  }
})
