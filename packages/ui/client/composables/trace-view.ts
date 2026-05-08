import type { BrowserTraceArtifact } from '@vitest/runner'
import type { RunnerTestCase } from 'vitest'
import type { BrowserTraceData } from '../../../browser/src/client/tester/trace'
import { computed, ref, watch, watchEffect } from 'vue'
import { client } from './client'
import { detailsPosition } from './navigation'
import { selectedTest } from './params'

export interface ActiveTraceView {
  test: RunnerTestCase
  attemptKey: string
}

export interface BrowserTraceArtifactWithData extends Omit<BrowserTraceArtifact, 'data'> {
  // fill up actual data type since runner-level BrowserTraceArtifact has `unknown`
  data: BrowserTraceData
}

// TODO: clear on watch re-run
interface TraceAttempt {
  test: RunnerTestCase
  // TODO: explicitly lift attempt key repeats/retry?
  key: string
  // TODO: should be directly BrowserTraceData
  artifacts: BrowserTraceArtifactWithData[]
}

export const activeTraceView = ref<ActiveTraceView>()

function getTraceAttemptKey(trace: BrowserTraceData): string {
  return `${trace.repeats}:${trace.retry}`
}

// TODO: ditch final artifact and just use merged stream entries
function getFinalTraceArtifact(artifacts: BrowserTraceArtifactWithData[]) {
  for (let i = artifacts.length - 1; i >= 0; i--) {
    if (!artifacts[i].data.stream) {
      return artifacts[i]
    }
  }
}

function deriveTraceAttempt(attempt: TraceAttempt): BrowserTraceArtifactWithData | undefined {
  const finalArtifact = getFinalTraceArtifact(attempt.artifacts)
  if (finalArtifact) {
    return finalArtifact
  }

  const firstArtifact = attempt.artifacts[0]
  if (!firstArtifact) {
    return
  }

  return {
    ...firstArtifact,
    data: {
      ...firstArtifact.data,
      entries: attempt.artifacts.flatMap(artifact => artifact.data.entries),
      stream: true,
    },
  }
}

function groupTraceAttempts(test: RunnerTestCase): TraceAttempt[] {
  const attempts = new Map<string, TraceAttempt>()
  for (const artifact of test.artifacts) {
    if (artifact.type !== 'internal:browserTrace') {
      continue
    }

    const trace = artifact as BrowserTraceArtifactWithData
    const key = getTraceAttemptKey(trace.data)
    let attempt = attempts.get(key)
    if (!attempt) {
      attempt = {
        test,
        key,
        artifacts: [],
      }
      attempts.set(key, attempt)
    }
    attempt.artifacts.push(trace)
  }

  return Array.from(attempts.values())
}

export function getTraceAttempts(test: RunnerTestCase): BrowserTraceArtifactWithData[] {
  return groupTraceAttempts(test)
    .map(attempt => deriveTraceAttempt(attempt))
    .filter((trace): trace is BrowserTraceArtifactWithData => !!trace)
}

export function useTraceAttempts(test: () => RunnerTestCase | undefined) {
  return computed(() => {
    const resolved = test()
    return resolved ? getTraceAttempts(resolved) : []
  })
}

// TODO: consolidate activeTraceView, activeTrace and useTraceAttempts.
export const activeTrace = computed(() => {
  const active = activeTraceView.value
  if (!active) {
    return
  }

  const attempt = groupTraceAttempts(active.test).find(attempt => attempt.key === active.attemptKey)
  const trace = attempt && deriveTraceAttempt(attempt)
  if (!trace) {
    return
  }

  return {
    test: active.test,
    trace,
  }
})

export function openTrace(trace: BrowserTraceArtifactWithData, test: RunnerTestCase) {
  detailsPosition.value = 'bottom'
  activeTraceView.value = {
    test,
    attemptKey: getTraceAttemptKey(trace.data),
  }
}

export function closeTrace() {
  activeTraceView.value = undefined
}

// sync with selected test / url navigation
watch(selectedTest, (testId) => {
  if (!testId || activeTraceView.value?.test.id !== testId) {
    closeTrace()
  }
})

// TODO: what's this
watchEffect(() => {
  const testId = selectedTest.value
  if (!testId || activeTraceView.value?.test.id === testId) {
    return
  }

  const test = client.state.idMap.get(testId)
  if (test?.type !== 'test') {
    return
  }

  const trace = getTraceAttempts(test)[0]
  if (trace) {
    openTrace(trace, test)
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
