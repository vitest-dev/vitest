import type { Page } from 'playwright'
import type { RunnerTestCase, TestContext, TestTryOptions } from 'vitest'
import { TestRunner } from 'vitest'
import { finishTraceAttempt, getTraceAttempt, startTraceAttempt } from './attempt'
import { createTraceRecorder } from './recorder'

type TraceFactory = (page: Page) => ReturnType<typeof createTraceRecorder>

declare module 'vitest' {
  interface TestContext {
    trace: TraceFactory
  }
}

export default class TraceRunner extends TestRunner {
  override extendTaskContext(context: TestContext): TestContext {
    super.extendTaskContext(context)
    context.trace = async (page) => {
      return createTraceRecorder(page, context.task, getTraceAttempt(context.task))
    }
    return context
  }

  override onBeforeTryTask(test: RunnerTestCase, options: TestTryOptions): void {
    super.onBeforeTryTask(test, options)
    startTraceAttempt(test, options)
  }

  onAfterRetryTask(test: RunnerTestCase): void {
    finishTraceAttempt(test)
  }
}
