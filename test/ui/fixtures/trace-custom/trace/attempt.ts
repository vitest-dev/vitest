import type { RunnerTestCase, TestContext, TestTryOptions } from 'vitest'
import type { TraceAttempt } from './recorder'

const traceAttemptKey = Symbol.for('vitest.traceAttempt')
type TraceContext = TestContext & { [traceAttemptKey]?: TraceAttempt }

export function startTraceAttempt(task: RunnerTestCase, options: TestTryOptions): void {
  const context = task.context as TraceContext
  context[traceAttemptKey] = {
    ...options,
    startTime: performance.now(),
  }
}

export function getTraceAttempt(task: TestContext['task']): TraceAttempt {
  const context = task.context as TraceContext
  const attempt = context[traceAttemptKey]
  if (!attempt) {
    throw new Error('Trace attempt was not initialized by the custom runner')
  }
  return attempt
}

export function finishTraceAttempt(task: RunnerTestCase): void {
  const context = task.context as TraceContext
  delete context[traceAttemptKey]
}
