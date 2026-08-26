import type { RunnerTestCase, TestTryOptions } from 'vitest'
import { TestRunner } from 'vitest'
import { finishTraceAttempt, startTraceAttempt } from './attempt'

export default class TraceRunner extends TestRunner {
  override onBeforeTryTask(test: RunnerTestCase, options: TestTryOptions): void {
    super.onBeforeTryTask(test, options)
    startTraceAttempt(test, options)
  }

  onAfterRetryTask(test: RunnerTestCase): void {
    finishTraceAttempt(test)
  }
}
