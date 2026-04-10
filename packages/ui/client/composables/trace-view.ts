import type { BrowserTraceArtifact } from '@vitest/runner'
import type { RunnerTestCase } from 'vitest'
import type { BrowserTraceData } from '../../../browser/src/client/tester/trace'
import { computed, ref, watch } from 'vue'
import { detailsPosition } from './navigation'
import { selectedTest } from './params'

// TODO: review slop (NEVER REMOVE COMMENT)

export const activeTrace = ref<BrowserTraceArtifact>()
export const activeTraceTest = ref<RunnerTestCase>()
export const selectedTraceStepIndex = ref(0)

export const activeTraceEntries = computed(() => {
  const trace = activeTrace.value
  if (!trace) {
    return []
  }
  return (trace.data as BrowserTraceData).entries
})

export const activeTraceLocationsByFile = computed(() => {
  const locationsByFile = new Map<string, Map<number, number[]>>()

  activeTraceEntries.value.forEach((entry, index) => {
    if (!entry.location) {
      return
    }

    let fileEntries = locationsByFile.get(entry.location.file)
    if (!fileEntries) {
      fileEntries = new Map()
      locationsByFile.set(entry.location.file, fileEntries)
    }

    const lineEntries = fileEntries.get(entry.location.line) || []
    lineEntries.push(index)
    fileEntries.set(entry.location.line, lineEntries)
  })

  return locationsByFile
})

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

export function selectTraceStepAtFileLine(file: string, line: number) {
  const lineEntries = activeTraceLocationsByFile.value.get(file)?.get(line)
  if (!lineEntries?.length) {
    return
  }

  const currentIndex = lineEntries.indexOf(selectedTraceStepIndex.value)
  selectedTraceStepIndex.value = currentIndex === -1
    ? lineEntries[0]
    : lineEntries[(currentIndex + 1) % lineEntries.length]
}

watch(selectedTest, (testId) => {
  if (!testId || activeTraceTest.value?.id !== testId) {
    closeTrace()
  }
})
