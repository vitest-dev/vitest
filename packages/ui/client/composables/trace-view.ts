import type { BrowserTraceArtifact } from '@vitest/runner'
import type { RunnerTestCase } from 'vitest'
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

function resolveActiveTrace(active: Pick<ActiveTraceView, 'test' | 'attemptKey'>) {
  const attempt = groupTraceAttempts(active.test).find(attempt => attempt.key === active.attemptKey)
  return attempt && deriveTraceAttempt(attempt)
}

function updateActiveTraceView(active: Pick<ActiveTraceView, 'test' | 'attemptKey'>) {
  activeTraceView.value = {
    ...active,
    trace: resolveActiveTrace(active),
  }
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
    updateActiveTraceView({
      test,
      attemptKey: active.attemptKey,
    })
  }
})

// Refresh derived trace data as new stream artifacts are appended to the active test.
watchEffect(() => {
  const active = activeTraceView.value
  if (!active) {
    return
  }

  const trace = resolveActiveTrace(active)
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
